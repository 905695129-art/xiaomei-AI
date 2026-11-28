import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const baseUrl = process.env.HEART_BASE_URL ?? "http://127.0.0.1:3000";
const creatorId = randomUUID();
const otherCreatorId = randomUUID();
const experienceId = randomUUID();
const slug = "cover-upload-ci-" + randomBytes(6).toString("hex");
const token = randomBytes(32).toString("hex");
const otherToken = randomBytes(32).toString("hex");

function psql(statement) {
  return execFileSync("docker", [
    "compose", "exec", "-T", "db", "psql", "-U", "heart", "-d", "heart_studio",
    "-v", "ON_ERROR_STOP=1", "-At", "-c", statement
  ], { encoding: "utf8" }).trim();
}

function sql(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

async function upload(cookie, bytes, type, filename = "cover.bin", purpose = null) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), filename);
  if (purpose) form.append("purpose", purpose);
  return fetch(new URL(`/api/creator/experiences/${experienceId}/cover-upload`, baseUrl), {
    method: "POST",
    headers: { cookie, "sec-fetch-site": "same-origin" },
    body: form,
    redirect: "manual"
  });
}

async function streamOversized(cookie) {
  const boundary = "heart-studio-upload-boundary";
  const prefix = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="oversize.png"\r\nContent-Type: image/png\r\n\r\n`);
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  const oversized = new Uint8Array(8 * 1024 * 1024 + 64 * 1024 + 128);
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(prefix);
      controller.enqueue(oversized);
      controller.enqueue(suffix);
      controller.close();
    }
  });
  return fetch(new URL(`/api/creator/experiences/${experienceId}/cover-upload`, baseUrl), {
    method: "POST",
    headers: {
      cookie,
      "sec-fetch-site": "same-origin",
      "content-type": `multipart/form-data; boundary=${boundary}`
    },
    body,
    duplex: "half",
    redirect: "manual"
  });
}

try {
  psql(`
    INSERT INTO users (id, email, display_name, password_hash, role) VALUES
      ('${creatorId}', ${sql("ci-cover-" + creatorId + "@example.test")}, 'Cover Upload CI', 'scrypt:test:test', 'creator'),
      ('${otherCreatorId}', ${sql("ci-cover-other-" + otherCreatorId + "@example.test")}, 'Other Creator CI', 'scrypt:test:test', 'creator');
    INSERT INTO creator_sessions (user_id, token_hash, expires_at) VALUES
      ('${creatorId}', '${createHash("sha256").update(token).digest("hex")}', now() + interval '1 hour'),
      ('${otherCreatorId}', '${createHash("sha256").update(otherToken).digest("hex")}', now() + interval '1 hour');
    INSERT INTO experiences (id, creator_id, slug, title, status)
    VALUES ('${experienceId}', '${creatorId}', '${slug}', 'Cover Upload CI', 'draft');
  `);

  const unauthenticated = await fetch(new URL(`/api/creator/experiences/${experienceId}/cover-upload`, baseUrl), {
    method: "POST", headers: { "sec-fetch-site": "same-origin" }
  });
  assert.equal(unauthenticated.status, 401, "upload requires creator authentication");

  const otherOwner = await upload("heart_session=" + otherToken, Buffer.from("x"), "text/plain");
  assert.equal(otherOwner.status, 404, "another creator must not upload to this experience");

  const cookie = "heart_session=" + token;
  const wrongMime = await upload(cookie, Buffer.from("not an image"), "text/plain");
  assert.equal(wrongMime.status, 400, "unsupported MIME must be rejected");

  const corruptPng = await upload(cookie, Buffer.from("not a PNG file"), "image/png", "spoof.png");
  assert.equal(corruptPng.status, 400, "spoofed image content must be rejected");

  const oversizedFile = await upload(cookie, Buffer.alloc(8 * 1024 * 1024 + 1), "image/png", "too-large.png");
  assert.equal(oversizedFile.status, 400, "file-level 8MB ceiling must be enforced");

  const oversizedStream = await streamOversized(cookie);
  assert.equal(oversizedStream.status, 413, "streaming request ceiling must be enforced without Content-Length");

  const png = await sharp({
    create: { width: 96, height: 64, channels: 3, background: { r: 246, g: 190, b: 205 } }
  }).png().toBuffer();
  const valid = await upload(cookie, png, "image/png", "cover.png");
  assert.equal(valid.status, 200, "valid authenticated image should upload");
  const result = await valid.json();
  assert.match(result.publicUrl, /^http:\/\/127\.0\.0\.1:9090\/heart-test\/covers\//);

  const stored = await fetch(result.publicUrl);
  assert.equal(stored.status, 200, "normalized cover should be publicly readable from the configured cover bucket");
  assert.match(stored.headers.get("content-type") || "", /image\/webp/i);
  const storedBytes = Buffer.from(await stored.arrayBuffer());
  assert.equal(storedBytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(storedBytes.toString("ascii", 8, 12), "WEBP");

  const savedCover = psql(`SELECT cover_url FROM experiences WHERE id = '${experienceId}'`);
  assert.equal(savedCover, result.publicUrl, "upload must persist cover_url in the creator's experience");

  const qrUpload = await upload(cookie, png, "image/png", "payment-qr.png", "payment_qr");
  assert.equal(qrUpload.status, 200, "valid payment QR should upload");
  const qrResult = await qrUpload.json();
  assert.match(qrResult.publicUrl, /^http:\/\/127\.0\.0\.1:9090\/heart-test\/payment-qr\//);
  const storedQr = await fetch(qrResult.publicUrl);
  assert.equal(storedQr.status, 200, "payment QR should be publicly readable");
  assert.match(storedQr.headers.get("content-type") || "", /image\/png/i);
  const qrBytes = Buffer.from(await storedQr.arrayBuffer());
  assert.equal(qrBytes.toString("hex", 0, 8), "89504e470d0a1a0a", "QR should be lossless PNG");
  const savedQr = psql("SELECT payment_qr_url FROM experiences WHERE id = '" + experienceId + "'");
  assert.equal(savedQr, qrResult.publicUrl, "payment_qr_url must be persisted");

  for (let index = 0; index < 4; index++) {
    const limited = await upload(cookie, Buffer.from("bad"), "text/plain");
    assert.equal(limited.status, 400);
  }
  const rateLimited = await fetch(new URL(`/api/creator/experiences/${experienceId}/cover-upload`, baseUrl), {
    method: "POST", headers: { cookie, "sec-fetch-site": "same-origin" }
  });
  assert.equal(rateLimited.status, 429, "eleventh request in one minute must be rate limited");
  assert.equal(rateLimited.headers.get("retry-after"), "60");

  console.log("PASS: creator auth/ownership, MIME and byte validation, streaming body cap, cover normalization, lossless QR PNG upload, S3 persistence, public image retrieval, and per-creator rate limit.");
} finally {
  psql(`DELETE FROM experiences WHERE id = '${experienceId}'; DELETE FROM users WHERE id IN ('${creatorId}', '${otherCreatorId}');`);
}
