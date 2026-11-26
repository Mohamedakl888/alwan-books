import { createClient } from "@supabase/supabase-js";
import { createGenerationWorker } from "../lib/generation-worker.mjs";

if (process.env.GENERATION_WORKER_ENABLED !== "true") {
  throw new Error("Set GENERATION_WORKER_ENABLED=true to start the generation worker.");
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required for the generation worker.");
}

const client = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const worker = createGenerationWorker({
  client,
  apiKey: process.env.OPENAI_API_KEY,
  imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.6-sunburst",
  reviewModel: process.env.OPENAI_REVIEW_MODEL || "gpt-6.2-astra"
});
const controller = new AbortController();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    worker.stop();
    controller.abort();
  });
}

console.log("Alwan generation worker started.");
worker.start(controller.signal)
  .then(() => console.log("Alwan generation worker stopped."))
  .catch(error => {
    console.error("Alwan generation worker stopped after an error:", error.message);
    process.exitCode = 1;
  });
