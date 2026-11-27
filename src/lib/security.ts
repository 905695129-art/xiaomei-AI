/**
 * Fail closed for browser write requests unless their source is demonstrably same-origin.
 * Origin is authoritative when present. If absent, only Fetch Metadata explicitly marked
 * same-origin is accepted; missing metadata is not treated as trusted.
 */
export function isSameOriginWrite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === new URL(request.url).origin;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export async function readJsonLimited(request: Request, maxBytes = 16 * 1024): Promise<
  { ok: true; value: unknown } | { ok: false; error: "REQUEST_TOO_LARGE" | "INVALID_REQUEST_BODY" | "INVALID_JSON" }
> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return { ok: false, error: "REQUEST_TOO_LARGE" };
  if (!request.body) return { ok: false, error: "INVALID_JSON" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, error: "REQUEST_TOO_LARGE" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, error: "INVALID_REQUEST_BODY" };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { ok: false, error: "INVALID_JSON" };
  }
}
