import { NextResponse } from "next/server";
import { isSameOriginWrite } from "@/lib/security";
import { randomUUID } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { requireDb } from "@/lib/db";
import { getCurrentCreator } from "@/lib/session";

export const dynamic = "force-dynamic";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export async function POST(request: Request, context: {
  if (!isSameOriginWrite(request)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403 }); params: { experienceId: string } }) {
  try {
    const creator = await getCurrentCreator();
    if (!creator) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const contentType = typeof body?.contentType === "string" ? body.contentType : "";
    const fileSize = Number(body?.fileSize);
    const extension = allowedTypes[contentType];
    if (!extension || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400 });
    }

    const endpoint = process.env.STORAGE_ENDPOINT;
    const bucket = process.env.STORAGE_BUCKET;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY;
    const secretAccessKey = process.env.STORAGE_SECRET_KEY;
    const publicBase = process.env.STORAGE_PUBLIC_URL;
    const region = process.env.STORAGE_REGION || "auto";
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBase) {
      return NextResponse.json({ error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
    }

    const db = requireDb();
    const [experience] = await db`SELECT id FROM experiences WHERE id = ${context.params.experienceId}::uuid AND creator_id = ${creator.id} LIMIT 1`;
    if (!experience) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const key = `covers/${experience.id}/${randomUUID()}.${extension}`;
    const client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey }
    });
    const signedPost = await createPresignedPost(client, {
      Bucket: bucket,
      Key: key,
      Expires: 300,
      Fields: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
      Conditions: [["content-length-range", 1, 8 * 1024 * 1024], ["eq", "$Content-Type", contentType]]
    });
    const publicUrl = `${publicBase.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
    return NextResponse.json({ uploadUrl: signedPost.url, fields: signedPost.fields, publicUrl, method: "POST" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: status === 503 ? "SERVICE_NOT_CONFIGURED" : "UPLOAD_INIT_FAILED" }, { status });
  }
}
