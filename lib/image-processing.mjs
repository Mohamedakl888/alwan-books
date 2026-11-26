import sharp from "sharp";

export function decodeImageDataUrl(value) {
  if (typeof value !== "string" || value.length > 11_200_000) return null;
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 8_388_608) return null;
  return buffer;
}

export async function normalizeChildPhoto(buffer) {
  try {
    const input = sharp(buffer, { limitInputPixels: 40_000_000, failOn: "error" });
    const metadata = await input.metadata();
    if (!["jpeg", "png"].includes(metadata.format) || !metadata.width || !metadata.height) {
      throw new Error("Unsupported image format");
    }
    if (metadata.width * metadata.height > 40_000_000) {
      throw new Error("Image dimensions exceed the safe limit");
    }

    for (const [width, quality] of [[1600, 82], [1280, 72], [1024, 62]]) {
      const output = await sharp(buffer, { limitInputPixels: 40_000_000, failOn: "error" })
        .rotate()
        .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (output.length <= 4_194_304) return output;
    }
    throw new Error("Image could not be compressed below the storage limit");
  } catch (cause) {
    const error = new Error("صورة الطفل غير صالحة أو يتعذر ضغطها بأمان.", { cause });
    error.status = 400;
    throw error;
  }
}
