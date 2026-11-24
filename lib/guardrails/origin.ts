/**
 * Blocks cross-site POSTs. Browsers always send an Origin header on cross-site
 * requests, so if one is present it must match this site's host. Requests with no
 * Origin (curl, the smoke script, server-to-server) are allowed: they can't be
 * driven by a stranger's web page, and the rate limit and spend caps still apply.
 */
export function isSameOrigin(req: { headers: { get(name: string): string | null } }): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false; // a malformed Origin is treated as hostile
  }
}
