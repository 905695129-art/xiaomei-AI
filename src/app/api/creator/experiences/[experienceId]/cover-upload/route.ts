import { NextResponse } from "next/server";
import { isSameOriginWrite } from "@/lib/security";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { normalizeCoverImage, normalizePaymentQrImage, MAX_COVER_BYTES } from "@/lib/cover-image";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store, private", Vary: "Cookie" };

export async function POST(request: Request) {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const experiencesIndex = segments.indexOf("experiences");
  const experienceId = experiencesIndex >= 0 ? segments[experiencesIndex + 1] : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(experienceId)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: privateHeaders });
  }
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403, headers: privateHeaders });
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: privateHeaders });

    const db = requireDb();
    const [experience] = await db`SELECT id FROM experiences WHERE id = ${experienceId}::uuid AND creator_id = ${creator.id} LIMIT 1`;
    if (!experience) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: privateHeaders });

    const [uploadQuota] = await db`
      INSERT INTO creator_upload_rate_limits (creator_id, window_started_at, request_count)
      VALUES (${creator.id}, now(), 1)
      ON CONFLICT (creator_id) DO UPDATE SET
        window_started_at = CASE
          WHEN creator_upload_rate_limits.window_started_at <= now() - interval '1 minute' THEN now()
          ELSE creator_upload_rate_limits.window_started_at
        END,
        request_count = CASE
          WHEN creator_upload_rate_limits.window_started_at <= now() - interval '1 minute' THEN 1
          ELSE creator_upload_rate_limits.request_count + 1
        END
      WHERE creator_upload_rate_limits.window_started_at <= now() - interval '1 minute'
         OR creator_upload_rate_limits.request_count < 10
      RETURNING request_count
    `;
    if (!uploadQuota) return NextResponse.json({ error: "UPLOAD_RATE_LIMITED" }, { status: 429, headers: { ...privateHeaders, "Retry-After": "60" } });

    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      if (!/^\d+$/.test(contentLengthHeader)) {
        return NextResponse.json({ error: "INVALID_CONTENT_LENGTH" }, { status: 400, headers: privateHeaders });
      }
      const contentLength = Number(contentLengthHeader);
      if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > MAX_COVER_BYTES + 64 * 1024) {
        return NextResponse.json({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers: privateHeaders });
      }
    }
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400, headers: privateHeaders });
    }

    // Enforce the request-body ceiling while streaming, including when Content-Length is absent
    // or dishonest. Do not let multipart parsing buffer an unbounded body first.
    if (!request.body) return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400, headers: privateHeaders });
    const reader = request.body.getReader();
    const chunks: Buffer[] = [];
    let received = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_COVER_BYTES + 64 * 1024) {
          await reader.cancel();
          return NextResponse.json({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers: privateHeaders });
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    const boundedHeaders = new Headers(request.headers);
    boundedHeaders.delete("content-length");
    const boundedRequest = new Request(request.url, {
      method: "POST",
      headers: boundedHeaders,
      body: Buffer.concat(chunks, received)
    });
    let form: FormData;
    try {
      form = await boundedRequest.formData();
    } catch {
      return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400, headers: privateHeaders });
    }
    const file = form.get("file");
    const purposeValue = form.get("purpose");
    if (purposeValue !== null && purposeValue !== "payment_qr") return NextResponse.json({ error: "INVALID_UPLOAD_PURPOSE" }, { status: 400, headers: privateHeaders });
    const purpose = purposeValue === "payment_qr" ? "payment_qr" : "cover";
    if (!(file instanceof File) || file.size <= 0 || file.size > MAX_COVER_BYTES) {
      return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400, headers: privateHeaders });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length !== file.size) return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400, headers: privateHeaders });

    // Decode, verify the actual format, rotate, resize, and re-encode before storage.
    let normalized: Buffer;
    try {
      normalized = purpose === "payment_qr" ? await normalizePaymentQrImage(bytes, file.type) : await normalizeCoverImage(bytes, file.type);
    } catch {
      return NextResponse.json({ error: "INVALID_IMAGE_CONTENT" }, { status: 400, headers: privateHeaders });
    }

    const endpoint = process.env.STORAGE_ENDPOINT;
    const bucket = process.env.STORAGE_BUCKET;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY;
    const secretAccessKey = process.env.STORAGE_SECRET_KEY;
    const publicBase = process.env.STORAGE_PUBLIC_URL;
    const region = process.env.STORAGE_REGION || "auto";
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBase) {
      return NextResponse.json({ error: "STORAGE_NOT_CONFIGURED" }, { status: 503, headers: privateHeaders });
    }

    const extension = purpose === "payment_qr" ? "png" : "webp";
    const contentType = purpose === "payment_qr" ? "image/png" : "image/webp";
    const key = `${purpose === "payment_qr" ? "payment-qr" : "covers"}/${experience.id}/${randomUUID()}.${extension}`;
    const client = new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: normalized, ContentLength: normalized.length,
      ContentType: contentType, CacheControl: "public, max-age=31536000, immutable"
    }));
    const publicUrl = `${publicBase.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
    try {
      const [updated] = await db`
        UPDATE experiences SET
          cover_url = CASE WHEN ${purpose} = 'cover' THEN ${publicUrl} ELSE cover_url END,
          payment_qr_url = CASE WHEN ${purpose} = 'payment_qr' THEN ${publicUrl} ELSE payment_qr_url END,
          updated_at = now()
        WHERE id = ${experience.id} AND creator_id = ${creator.id}
        RETURNING id
      `;
      if (!updated) throw new Error("EXPERIENCE_UPDATE_FAILED");
    } catch (error) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
      throw error;
    }
    return NextResponse.json({ publicUrl, purpose }, { headers: privateHeaders });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "UPLOAD_FAILED" }, { status, headers: privateHeaders });
  }
}
