import { NextResponse } from "next/server";
import { isSameOriginWrite } from "@/lib/security";
import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const maxBytes = 8 * 1024 * 1024;
const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};
const maxPixels = 20_000_000;

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

    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      if (!/^\d+$/.test(contentLengthHeader)) {
        return NextResponse.json({ error: "INVALID_CONTENT_LENGTH" }, { status: 400, headers: privateHeaders });
      }
      const contentLength = Number(contentLengthHeader);
      if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > maxBytes + 64 * 1024) {
        return NextResponse.json({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers: privateHeaders });
      }
    }
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400, headers: privateHeaders });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0 || file.size > maxBytes || !allowedTypes[file.type]) {
      return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400, headers: privateHeaders });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length !== file.size) return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400, headers: privateHeaders });

    // Decode the full image with a pixel ceiling, verify its actual format, rotate by EXIF,
    // resize, and re-encode. This strips source metadata and prevents serving the raw upload.
    let normalized: Buffer;
    try {
      const source = sharp(bytes, { limitInputPixels: maxPixels, failOn: "error" });
      const metadata = await source.metadata();
      if (!metadata.format || metadata.format !== allowedTypes[file.type] ||
          !metadata.width || !metadata.height || metadata.width * metadata.height > maxPixels) {
        return NextResponse.json({ error: "INVALID_IMAGE_CONTENT" }, { status: 400, headers: privateHeaders });
      }
      normalized = await source.rotate()
        .resize({ width: 2400, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } catch {
      return NextResponse.json({ error: "INVALID_IMAGE_CONTENT" }, { status: 400, headers: privateHeaders });
    }
    if (!normalized.length || normalized.length > maxBytes) {
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

    const db = requireDb();
    const [experience] = await db`SELECT id FROM experiences WHERE id = ${experienceId}::uuid AND creator_id = ${creator.id} LIMIT 1`;
    if (!experience) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: privateHeaders });

    const key = `covers/${experience.id}/${randomUUID()}.webp`;
    const client = new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: normalized, ContentLength: normalized.length,
      ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable"
    }));
    const publicUrl = `${publicBase.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
    return NextResponse.json({ publicUrl }, { headers: privateHeaders });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "UPLOAD_FAILED" }, { status, headers: privateHeaders });
  }
}
