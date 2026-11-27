/**
 * Reject cross-origin browser writes that could ride an authenticated creator cookie.
 * Requests without an Origin header remain available to non-browser clients; browser
 * POST/PATCH/PUT requests normally include Origin and must match the request host.
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
  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite !== "cross-site";
}
