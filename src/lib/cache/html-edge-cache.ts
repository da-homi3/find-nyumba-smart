type WaitUntilCtx = { waitUntil?: (promise: Promise<unknown>) => void };

const HTML_CACHE_CONTROL = "public, max-age=45, stale-while-revalidate=180";

/** Paths that must never be colo-cached as HTML (auth / dashboards). */
const SKIP_PREFIXES = [
  "/api",
  "/auth",
  "/admin",
  "/landlord",
  "/agency",
  "/manager",
  "/caretaker",
  "/settings",
  "/checkout",
  "/portal",
] as const;

function edgeCache(): Cache | undefined {
  try {
    return (globalThis as typeof globalThis & { caches?: { default?: Cache } }).caches?.default;
  } catch {
    return undefined;
  }
}

function shouldSkipPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return SKIP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isPublicHtmlCacheable(request: Request, response: Response): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (response.status !== 200) return false;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return false;
  return !shouldSkipPath(new URL(request.url).pathname);
}

function htmlCacheKey(request: Request): Request {
  const url = new URL(request.url);
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return new Request(url.toString(), { method: "GET" });
}

/** Serve colo-cached public HTML when available (skips SSR on HIT). */
export async function matchPublicHtmlCache(request: Request): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (shouldSkipPath(new URL(request.url).pathname)) return null;

  const cache = edgeCache();
  if (!cache) return null;
  try {
    const hit = await cache.match(htmlCacheKey(request));
    if (!hit) return null;
    const headers = new Headers(hit.headers);
    headers.set("X-HTML-Edge-Cache", "HIT");
    return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
  } catch {
    return null;
  }
}

/** Attach Cache-Control and store eligible HTML in the colo Cache API. */
export function storePublicHtmlCache(
  request: Request,
  response: Response,
  ctx?: WaitUntilCtx,
): Response {
  if (!isPublicHtmlCacheable(request, response)) return response;

  const headers = new Headers(response.headers);
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", HTML_CACHE_CONTROL);
  }
  headers.set("X-HTML-Edge-Cache", "MISS");

  const out = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  const cache = edgeCache();
  if (!cache) return out;

  const put = cache.put(htmlCacheKey(request), out.clone()).catch(() => undefined);
  if (typeof ctx?.waitUntil === "function") ctx.waitUntil(put);
  else void put;

  return out;
}
