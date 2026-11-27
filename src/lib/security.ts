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
