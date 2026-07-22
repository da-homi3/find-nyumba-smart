/** Android WebView + low-bandwidth detection from incoming request headers. */

export type ServeMode = "full" | "lite";

export type AppServeContext = {
  isAppClient: boolean;
  appVersion: string | null;
  networkTier: string | null;
  saveData: boolean;
  serveMode: ServeMode;
};

export function getAppServeContext(request: Request): AppServeContext {
  const isAppClient = request.headers.get("X-App-Client") === "android";
  const networkTier = request.headers.get("X-Network-Tier");
  const saveData = request.headers.get("Save-Data") === "on";
  const isLowBandwidth = networkTier === "POOR_2G_3G" || saveData;
  const serveMode: ServeMode = isAppClient && isLowBandwidth ? "lite" : "full";

  return {
    isAppClient,
    appVersion: request.headers.get("X-App-Version"),
    networkTier,
    saveData,
    serveMode,
  };
}

export function withAppClientHeaders(response: Response, ctx: AppServeContext): Response {
  const headers = new Headers(response.headers);

  if (ctx.serveMode === "lite") {
    headers.set("X-Serve-Mode", "lite");
    headers.append(
      "Set-Cookie",
      "nyumba_serve_mode=lite; Path=/; Max-Age=86400; SameSite=Strict; Secure",
    );
  }

  if (ctx.isAppClient) {
    headers.set("X-App-Client-Ack", "android");
    if (ctx.appVersion) headers.set("X-App-Version-Ack", ctx.appVersion);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Client-side lite mode check (cookie set by Worker on first HTML response). */
export function isLiteServeMode(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.dataset.serveMode === "lite") return true;
  return document.cookie.split(";").some((c) => c.trim() === "nyumba_serve_mode=lite");
}

/** Resize listing images for faster cards. Lite mode uses smaller variants. */
export function optimizeImageUrlForServeMode(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
  try {
    const parsed = new URL(trimmed, "https://nyumbasearch.com");
    const host = parsed.hostname;
    const supportsResize =
      host.includes("supabase.co") ||
      host.includes("unsplash.com") ||
      host.includes("images.unsplash.com");
    if (!supportsResize) return trimmed;

    const lite = isLiteServeMode();
    const w = lite ? "400" : "720";
    const q = lite ? "60" : "72";
    if (!parsed.searchParams.has("w")) parsed.searchParams.set("w", w);
    if (!parsed.searchParams.has("q")) parsed.searchParams.set("q", q);
    return parsed.toString();
  } catch {
    return trimmed;
  }
}
