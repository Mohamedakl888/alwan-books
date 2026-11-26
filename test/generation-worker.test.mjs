import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import {
  buildColoringPrompt,
  buildPhotoReviewRequest,
  createIllustrationPdf,
  createGenerationWorker,
  isPhotoApproved,
  parsePhotoReviewResponse,
  processGenerationJob,
  retryDelayMs
} from "../lib/generation-worker.mjs";

test("photo-review request only asks for technical face quality", () => {
  const request = buildPhotoReviewRequest("data:image/jpeg;base64,abc", "review-model");
  assert.equal(request.store, false);
  assert.equal(request.model, "review-model");
  assert.match(request.input[0].content[0].text, /technical photo quality only/);
  assert.match(request.input[0].content[0].text, /Do not identify the person/);
  assert.equal(request.input[0].content[1].image_url, "data:image/jpeg;base64,abc");
});

test("photo review fails closed for ambiguous and malformed results", () => {
  const clear = parsePhotoReviewResponse({
    output_text: JSON.stringify({ face_count: 1, face_clear: true, face_frontal: true, uncertain: false })
  });
  const ambiguous = parsePhotoReviewResponse({
    output_text: JSON.stringify({ face_count: 2, face_clear: true, face_frontal: true, uncertain: false })
  });
  assert.equal(isPhotoApproved(clear), true);
  assert.equal(isPhotoApproved(ambiguous), false);
  assert.equal(isPhotoApproved(parsePhotoReviewResponse({ output_text: "not JSON" })), false);
});

test("coloring prompts constrain user details to harmless themes and omit names", () => {
  const prompt = buildColoringPrompt({
    interests: 'space <script>alert("x")</script>',
    pageNumber: 1,
    pageCount: 20
  });
  assert.match(prompt, /children's coloring book/);
  assert.match(prompt, /fully clothed/);
  assert.match(prompt, /No gray, shading, color/);
  assert.doesNotMatch(prompt, /[<>]/);
});

test("worker retries use bounded exponential delay and require explicit configuration", () => {
  assert.equal(retryDelayMs(1), 30_000);
  assert.equal(retryDelayMs(3), 120_000);
  assert.equal(retryDelayMs(20), 15 * 60_000);
  assert.throws(() => createGenerationWorker({ client: {}, apiKey: "" }), /OPENAI_API_KEY/);
});

test("illustrations are assembled as one A4 PDF page per generated image", async () => {
  const image = await sharp({
    create: { width: 4, height: 6, channels: 3, background: "#ffffff" }
  }).jpeg().toBuffer();
  const result = await createIllustrationPdf([image, image]);
  const pdf = await PDFDocument.load(result);
  assert.equal(pdf.getPageCount(), 2);
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 595.28) < 0.1);
  assert.ok(Math.abs(pdf.getPage(0).getHeight() - 841.89) < 0.1);
});

test("photo review will not call the provider without parental consent and a matching photo", async () => {
  let reviewCalled = false;
  const order = {
    id: "ALW-1",
    ai_processing_consent_at: null,
    payment_status: "paid",
    children: [{ photoPath: "orders/child.jpg" }]
  };
  const client = {
    from(table) {
      assert.equal(table, "orders");
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: order, error: null }; }
      };
    }
  };
  await assert.rejects(processGenerationJob({
    id: "job-1",
    order_id: order.id,
    child_index: 0,
    source_image_path: "orders/child.jpg",
    job_type: "photo_review"
  }, {
    client,
    openAi: { async reviewImage() { reviewCalled = true; return {}; } }
  }), /source_consent_or_photo_missing/);
  assert.equal(reviewCalled, false);
});

test("worker claims, reviews, and completes a consented photo job without exposing its key", async () => {
  const job = {
    id: "job-1",
    order_id: "ALW-1",
    preview_id: null,
    child_index: 0,
    source_image_path: "orders/child.jpg",
    job_type: "photo_review",
    status: "processing",
    attempts: 1,
    max_attempts: 3,
    worker_token: "lease-1",
    payload: {}
  };
  const order = {
    id: "ALW-1",
    payment_status: "paid",
    ai_processing_consent_at: "2026-01-01T00:00:00.000Z",
    children: [{ photoPath: "orders/child.jpg" }]
  };
  const jobUpdates = [];
  const ownerUpdates = [];
  const client = {
    async rpc(name) {
      assert.equal(name, "claim_generation_job");
      return { data: [job], error: null };
    },
    from(table) {
      let filters = {};
      let changes = null;
      const builder = {
        select() { return this; },
        update(value) { changes = value; return this; },
        eq(key, value) { filters[key] = value; return this; },
        async maybeSingle() {
          if (table === "orders" && !changes) return { data: order, error: null };
          if (table === "generation_jobs" && !changes) {
            return filters.worker_token === job.worker_token && filters.status === "processing"
              ? { data: { id: job.id }, error: null }
              : { data: null, error: null };
          }
          const matches = table === "generation_jobs"
            ? filters.id === job.id && filters.worker_token === job.worker_token && filters.status === job.status
            : filters.id === order.id;
          if (!matches) return { data: null, error: null };
          if (table === "generation_jobs") {
            jobUpdates.push(changes);
            Object.assign(job, changes);
            return { data: { id: job.id }, error: null };
          }
          ownerUpdates.push(changes);
          Object.assign(order, changes);
          return { data: { id: order.id }, error: null };
        },
        then(resolve, reject) {
          return this.maybeSingle().then(resolve, reject);
        }
      };
      return builder;
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "child-photos");
        return {
          async download(path) {
            assert.equal(path, "orders/child.jpg");
            return { data: new Blob([Buffer.from("photo")]), error: null };
          }
        };
      }
    }
  };
  let requestUrl = "";
  const worker = createGenerationWorker({
    client,
    apiKey: "test-key-not-logged",
    fetchImpl: async (url, options) => {
      requestUrl = url;
      assert.match(options.headers.Authorization, /^Bearer /);
      return new Response(JSON.stringify({
        output_text: JSON.stringify({ face_count: 1, face_clear: true, face_frontal: true, uncertain: false })
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
    logger: { error() {} }
  });

  assert.equal(await worker.runOnce(), true);
  assert.equal(requestUrl, "https://api.openai.com/v1/responses");
  assert.ok(jobUpdates.some(update => update.status === "completed" && update.worker_token === null));
  assert.deepEqual(ownerUpdates.map(update => update.generation_status), ["processing", "queued"]);
});
