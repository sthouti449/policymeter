// Security headers, built here so they can be unit-tested and used by next.config.ts.
// No database or model code touches the browser (everything is server-side), so the
// policy can be strict: only this site's own scripts, styles and API calls.

export interface Header { key: string; value: string }

/**
 * Next.js needs inline scripts and styles to hydrate pages, so 'unsafe-inline' stays
 * (a nonce-based policy would need middleware on every request). In development React
 * also needs eval for debugging, so the CSP is only sent for production builds.
 */
export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'", // the browser only ever calls this site's own /api routes
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function securityHeaders(production: boolean): Header[] {
  const headers: Header[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
  if (production) {
    headers.push({ key: "Content-Security-Policy", value: contentSecurityPolicy() });
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}
