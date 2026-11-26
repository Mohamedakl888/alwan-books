import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { decodeImageDataUrl, normalizeChildPhoto } from "../lib/image-processing.mjs";

test("decodes only bounded JPEG and PNG data URLs", async () => {
  const png = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#ffffff" }
  }).png().toBuffer();
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

  assert.deepEqual(decodeImageDataUrl(dataUrl), png);
  assert.equal(decodeImageDataUrl("data:image/gif;base64,AAAA"), null);
  assert.equal(decodeImageDataUrl("not an image"), null);
});

test("normalizes large PNG uploads to a bounded JPEG", async () => {
  const png = await sharp({
    create: { width: 2200, height: 1200, channels: 3, background: "#abcdef" }
  }).png().toBuffer();

  const normalized = await normalizeChildPhoto(png);
  const metadata = await sharp(normalized).metadata();

  assert.equal(metadata.format, "jpeg");
  assert.ok(metadata.width <= 1600);
  assert.ok(metadata.height <= 1600);
  assert.ok(normalized.length <= 4_194_304);
});

test("rejects malformed image payloads with a client error status", async () => {
  await assert.rejects(normalizeChildPhoto(Buffer.from("not an image")), error => error.status === 400);
});
