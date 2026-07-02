/** Security response headers applied to every Worker response. */
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=(), payment=()");
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self' https://nyumbasearch.com",
      "script-src 'self' 'unsafe-inline' https://api.mapbox.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://api.mapbox.com https://*.mapbox.com",
      "connect-src 'self' https://*.supabase.co https://api.mapbox.com https://*.mapbox.com https://graph.facebook.com",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
