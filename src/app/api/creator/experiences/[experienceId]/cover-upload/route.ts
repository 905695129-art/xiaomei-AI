import { NextResponse } from "next/server";
import { isSameOriginWrite } from "@/lib/security";
import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const maxBytes = 8 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function dimensions(type: string, bytes: Buffer): { width: number; height: number } | null {
  if (type === "image/png" && bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (type === "image/gif" && bytes.length >= 10 && (bytes.toString("ascii", 0, 6) === "GIF87a" || bytes.toString("ascii", 0, 6) === "GIF89a")) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (type === "image/webp" && bytes.length >= 30 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (chunk === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      return { width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]), height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6)) };
    }
    return null;
  }
  if (type === "image/jpeg" && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      while (offset < bytes.length && bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) return null;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) return null;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        if (length < 7) return null;
        return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
      }
      offset += length;
    }
  }
  return null;
}

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

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > maxBytes + 64 * 1024) return NextResponse.json({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers: privateHeaders });
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400, headers: privateHeaders });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0 || file.size > maxBytes || !allowedTypes.has(file.type)) {
      return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400, headers: privateHeaders });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length !== file.size) return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400, headers: privateHeaders });
    const size = dimensions(file.type, bytes);
    if (!size || size.width < 1 || size.height < 1 || size.width * size.height > 40_000_000) {
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

    const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as Record<string,string>)[file.type];
    const key = `covers/${experience.id}/${randomUUID()}.${extension}`;
    const client = new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: bytes, ContentLength: bytes.length,
      ContentType: file.type, CacheControl: "public, max-age=31536000, immutable"
    }));
    const publicUrl = `${publicBase.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
    return NextResponse.json({ publicUrl }, { headers: privateHeaders });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "UPLOAD_FAILED" }, { status, headers: privateHeaders });
  }
}
