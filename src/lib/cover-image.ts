import sharp from "sharp";

export const MAX_COVER_BYTES = 8 * 1024 * 1024;
export const MAX_COVER_PIXELS = 20_000_000;

const allowedFormats: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export async function normalizeCoverImage(bytes: Buffer, declaredMime: string): Promise<Buffer> {
  if (!bytes.length || bytes.length > MAX_COVER_BYTES || !allowedFormats[declaredMime]) {
    throw new Error("INVALID_IMAGE");
  }
  const source = sharp(bytes, { limitInputPixels: MAX_COVER_PIXELS, failOn: "error", animated: false });
  const metadata = await source.metadata();
  if (!metadata.format || metadata.format !== allowedFormats[declaredMime] ||
      !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_COVER_PIXELS) {
    throw new Error("INVALID_IMAGE_CONTENT");
  }
  const normalized = await source.rotate()
    .resize({ width: 2400, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  if (!normalized.length || normalized.length > MAX_COVER_BYTES) throw new Error("INVALID_IMAGE_CONTENT");
  return normalized;
}
