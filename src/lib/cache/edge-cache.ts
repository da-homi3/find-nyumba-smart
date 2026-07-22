type WaitUntilCtx = { waitUntil?: (promise: Promise<unknown>) => void };

function edgeCache(): Cache | undefined {
  try {
    // Cloudflare Workers Cache API — available on Paid (and Free, but with tighter quotas).
    return (globalThis as typeof globalThis & { caches?: { default?: Cache } }).caches?.default;
  } catch {
    return undefined;
  }
}

/**
 * Colo-local Cache API layer in front of KV-backed handlers.
 * Short TTLs via response Cache-Control; pass `cacheKeyUrl` (e.g. with listings epoch)
 * so KV invalidation also busts the edge layer.
 */
export async function withEdgeCache(
  request: Request,
  ctx: WaitUntilCtx | undefined,
  handler: () => Promise<Response>,
  opts?: { cacheKeyUrl?: string },
): Promise<Response> {
  if (request.method !== "GET") return handler();

  const cache = edgeCache();
  if (!cache) return handler();

  const key = new Request(opts?.cacheKeyUrl ?? request.url, {
    method: "GET",
    headers: { Accept: request.headers.get("Accept") ?? "application/json" },
  });

  try {
    const hit = await cache.match(key);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set("X-Edge-Cache", "HIT");
      return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
    }
  } catch {
    // Cache API unavailable in some runtimes — fall through.
  }

  const response = await handler();
  if (!response.ok) return response;

  const cacheControl = response.headers.get("Cache-Control") ?? "";
  if (!/max-age=\d+/i.test(cacheControl) || /no-store/i.test(cacheControl)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("X-Edge-Cache", "MISS");
  const out = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  const toStore = out.clone();
  const put = cache.put(key, toStore).catch(() => undefined);
  if (typeof ctx?.waitUntil === "function") ctx.waitUntil(put);
  else void put;

  return out;
}
