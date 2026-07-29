/** Security response headers applied to every Worker response. */
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "geolocation=(self), camera=(), microphone=(), payment=()");
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self' https://nyumbasearch.com",
      "script-src 'self' 'unsafe-inline' https://api.mapbox.com https://maps.googleapis.com https://maps.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
      "font-src 'self' https://fonts.gstatic.com",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "img-src 'self' data: blob: https://*.supabase.co https://api.mapbox.com https://*.mapbox.com https://images.unsplash.com https://maps.gstatic.com https://*.googleusercontent.com https://*.ggpht.com",
      // Walkthrough <video> loads from Supabase signed URLs; without media-src this falls back to default-src and blocks playback.
      "media-src 'self' blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co https://api.mapbox.com https://*.mapbox.com https://events.mapbox.com https://graph.facebook.com https://maps.googleapis.com https://maps.gstatic.com",
      "frame-src 'self' https://www.youtube.com https://youtube.com https://player.vimeo.com https://my.matterport.com https://*.matterport.com https://kuula.co https://roundme.com",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
