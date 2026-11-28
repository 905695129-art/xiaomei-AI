import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizeCoverImage, MAX_COVER_BYTES, MAX_COVER_PIXELS } from "../src/lib/cover-image.ts";

const sourcePng = await sharp({
  create: { width: 64, height: 48, channels: 3, background: { r: 255, g: 120, b: 160 } }
}).png().withMetadata({ exif: { IFD0: { Artist: "private-metadata-test" } } }).toBuffer();

const normalized = await normalizeCoverImage(sourcePng, "image/png");
const output = await sharp(normalized).metadata();
assert.equal(output.format, "webp", "output must be normalized to WebP");
assert.equal(output.width, 64);
assert.equal(output.height, 48);
assert.equal(output.exif, undefined, "source EXIF metadata must not survive normalization");
assert.equal(output.icc, undefined, "source ICC metadata must not survive normalization");

await assert.rejects(
  () => normalizeCoverImage(Buffer.from("not an image"), "image/png"),
  "invalid byte stream must be rejected"
);
await assert.rejects(
  () => normalizeCoverImage(sourcePng, "image/jpeg"),
  "declared MIME must match decoded image format"
);
await assert.rejects(
  () => normalizeCoverImage(Buffer.alloc(MAX_COVER_BYTES + 1), "image/png"),
  "oversized input must be rejected before decoding"
);
assert.equal(MAX_COVER_PIXELS, 20_000_000);
console.log("PASS: cover normalization, format verification, malformed-image rejection, byte limit, WebP output, and metadata stripping.");
