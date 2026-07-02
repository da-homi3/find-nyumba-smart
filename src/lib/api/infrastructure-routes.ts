import { getSiteUrl } from "@/lib/site";
import {
  applyRateLimitHeaders,
  rateLimitDistributed,
  rateLimitKeyFromHeaders,
  RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { withCache } from "@/lib/cache/manager";
import { normalizeNeighborhoodFilter } from "@/lib/security/neighborhoods";

type RouteHandler = (request: Request) => Promise<Response>;

function withPublicRateLimit(
  req: Request,
  endpoint: keyof typeof RATE_LIMITS,
  handler: RouteHandler,
): Promise<Response> {
  const ip = rateLimitKeyFromHeaders(req.headers);
  return rateLimitDistributed(`api:${endpoint}:${ip}`, RATE_LIMITS[endpoint]).then((result) => {
    if (result.limited) {
      return applyRateLimitHeaders(
        new Response(JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
        result,
      );
    }
    return handler(req).then((res) => {
      const headers = new Headers(res.headers);
      headers.set("X-Cache", headers.get("X-Cache") ?? "MISS");
      return applyRateLimitHeaders(
        new Response(res.body, { status: res.status, headers }),
        result,
      );
    });
  });
}

async function withErrorHandler(
  label: string,
  req: Request,
  handler: RouteHandler,
  onError?: () => Response,
): Promise<Response> {
  try {
    return await handler(req);
  } catch (err) {
    console.error(`${label} error:`, err);
    return onError?.() ?? new Response("Error", { status: 500 });
  }
}

async function handleMpesaCallback(req: Request): Promise<Response> {
  const { handleMpesaWebhook } = await import("@/lib/payments/webhook-handlers");
  return handleMpesaWebhook(req);
}

async function handlePesapalIpn(req: Request): Promise<Response> {
  const { handlePesapalWebhook } = await import("@/lib/payments/webhook-handlers");
  return handlePesapalWebhook(req);
}

async function handleCardCallback(req: Request): Promise<Response> {
  const { handlePesapalRedirect } = await import("@/lib/payments/webhook-handlers");
  return handlePesapalRedirect(req);
}

async function handleRenewalCronRoute(req: Request): Promise<Response> {
  const { handleRenewalCron } = await import("@/lib/payments/webhook-handlers");
  return handleRenewalCron(req);
}

async function handleDailyCronRoute(req: Request): Promise<Response> {
  const { handleDailyCron } = await import("@/lib/payments/webhook-handlers");
  return handleDailyCron(req);
}

async function handleWeeklyCronRoute(req: Request): Promise<Response> {
  const { handleWeeklyCron } = await import("@/lib/payments/webhook-handlers");
  return handleWeeklyCron(req);
}

async function handleMonthlyCronRoute(req: Request): Promise<Response> {
  const { handleMonthlyCron } = await import("@/lib/payments/webhook-handlers");
  return handleMonthlyCron(req);
}

async function handleWhatsAppWebhook(req: Request): Promise<Response> {
  const { handleWhatsAppWebhookRequest } = await import("@/lib/whatsapp/webhook");
  return handleWhatsAppWebhookRequest(req);
}

async function handleV1Api(req: Request): Promise<Response> {
  const { handleV1Api } = await import("@/lib/api/v1/router");
  return handleV1Api(req);
}

async function handleListingsApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { queryListings } = await import("@/lib/api/listings-core");
  const { propertyTypeSchema } = await import("@/lib/api/nyumba/nyumba-shared");

  const typeRaw = url.searchParams.get("type");
  const parsedType = typeRaw ? propertyTypeSchema.safeParse(typeRaw) : null;

  const filters = {
    limit: Number(url.searchParams.get("limit") ?? "50"),
    offset: Number(url.searchParams.get("offset") ?? "0"),
    query: url.searchParams.get("q") ?? undefined,
    neighborhood: normalizeNeighborhoodFilter(url.searchParams.get("neighborhood")),
    propertyType: parsedType?.success ? parsedType.data : undefined,
    minRent: url.searchParams.get("minRent")
      ? Number(url.searchParams.get("minRent"))
      : undefined,
    maxRent: url.searchParams.get("maxRent")
      ? Number(url.searchParams.get("maxRent"))
      : undefined,
    verifiedOnly: url.searchParams.get("verifiedOnly") === "1",
    minBedrooms: url.searchParams.get("minBedrooms")
      ? Number(url.searchParams.get("minBedrooms"))
      : undefined,
    sortBy: (url.searchParams.get("sortBy") as
      | "newest"
      | "price_asc"
      | "price_desc"
      | "score"
      | null) ?? "newest",
  };

  const result = await queryListings(filters);
  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

async function handleListingsHealth(): Promise<Response> {
  const { listingsHealthCheck } = await import("@/lib/api/listings-core");
  const health = await listingsHealthCheck();
  return new Response(JSON.stringify(health), {
    status: health.ok ? 200 : 503,
    headers: { "Content-Type": "application/json" },
  });
}

async function handlePublicStatsApi(): Promise<Response> {
  const { data, cacheHit } = await withCache("platform_stats", "platform_stats", async () => {
    const { loadPublicStats } = await import("@/lib/api/stats.functions");
    return loadPublicStats();
  });
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
      "X-Cache": cacheHit ? "HIT" : "MISS",
    },
  });
}

async function handleTestimonialsApi(): Promise<Response> {
  const { data, cacheHit } = await withCache("testimonials", "testimonials", async () => {
    const { loadFeaturedTestimonials } = await import("@/lib/api/homepage.functions");
    return loadFeaturedTestimonials();
  });
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
      "X-Cache": cacheHit ? "HIT" : "MISS",
    },
  });
}

async function handleIntelligenceStatsApi(): Promise<Response> {
  const { data, cacheHit } = await withCache("intelligence_stats", "intelligence_stats", async () => {
    const { loadPropertyIntelligenceStats } = await import("@/lib/api/homepage.functions");
    return loadPropertyIntelligenceStats();
  });
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
      "X-Cache": cacheHit ? "HIT" : "MISS",
    },
  });
}

async function handleFeaturedAgenciesApi(): Promise<Response> {
  const { data, cacheHit } = await withCache("agency_featured", "agency_featured", async () => {
    const { loadFeaturedAgencies } = await import("@/lib/api/homepage.functions");
    return loadFeaturedAgencies();
  });
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=600, stale-while-revalidate=1800",
      "X-Cache": cacheHit ? "HIT" : "MISS",
    },
  });
}

async function handleClientErrors(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  console.error("[client-error]", JSON.stringify(body).slice(0, 2000));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function checkSupabaseHealth(): Promise<{ name: string; status: string; error?: string }> {
  try {
    const { listingsHealthCheck } = await import("@/lib/api/listings-core");
    const health = await listingsHealthCheck();
    return { name: "supabase_listings", status: health.ok ? "ok" : "error" };
  } catch (e) {
    return {
      name: "supabase_listings",
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkKvHealth(): Promise<{ name: string; status: string; error?: string }> {
  const kv = (await import("@/lib/kv/bindings")).getCacheKv();
  if (!kv) return { name: "kv", status: "missing" };
  try {
    await kv.put("health:check", "1", { expirationTtl: 60 });
    return { name: "kv", status: "ok" };
  } catch (e) {
    return {
      name: "kv",
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function checkMpesaConfig(): { name: string; status: string } {
  const configured = Boolean(
    process.env.MPESA_CONSUMER_KEY && process.env.MPESA_SHORTCODE && process.env.MPESA_PASSKEY,
  );
  return { name: "mpesa_config", status: configured ? "ok" : "missing" };
}

async function handleHealthCheck(): Promise<Response> {
  const start = Date.now();
  const checks = await Promise.all([
    checkSupabaseHealth(),
    checkKvHealth(),
    Promise.resolve(checkMpesaConfig()),
  ]);

  const healthy = checks.every((c) => c.status === "ok" || c.status === "missing");
  const durationMs = Date.now() - start;

  if (!healthy) {
    const { Monitors } = await import("@/lib/alerts/monitors");
    Monitors.healthCheckFailed(checks.filter((c) => c.status === "error")).catch(() => {});
  }

  return new Response(
    JSON.stringify({
      status: healthy ? "healthy" : "degraded",
      checks,
      durationMs,
      timestamp: new Date().toISOString(),
    }),
    {
      status: healthy ? 200 : 503,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function handleCookieConsent(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    analytics?: boolean;
    marketing?: boolean;
    preferences?: boolean;
  };

  const ipRaw =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const secret = process.env.CARETAKER_SESSION_SECRET ?? process.env.CRON_SECRET ?? "consent";
  const ipHash = await crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(`${ipRaw}:${secret}`))
    .then((buf) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("cookie_consent").insert({
      id: crypto.randomUUID(),
      ip_hash: ipHash,
      necessary: true,
      analytics: Boolean(body.analytics),
      marketing: Boolean(body.marketing),
      preferences: Boolean(body.preferences),
      consent_version: "1.0",
    });
  } catch (e) {
    console.warn("[cookie-consent] persist skipped:", e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleHealthConnections(): Promise<Response> {
  const { checkConnections } = await import("@/lib/api/connections-health");
  const connections = await checkConnections();
  const healthy = connections.every((c) => c.status !== "missing");
  return new Response(JSON.stringify({ healthy, connections }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleAiProbe(): Promise<Response> {
  const { probeNyumbaAi } = await import("@/lib/api/ai-client");
  const result = await probeNyumbaAi();
  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
}

function handleRobotsTxt(): Response {
  const site = getSiteUrl();
  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /landlord/dashboard\n\nSitemap: ${site}/sitemap.xml\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}

async function handleSitemapXml(): Promise<Response> {
  try {
    const { createPublicClient } = await import("@/lib/api/public-client");
    const supabase = createPublicClient();
    const { data: properties } = await supabase
      .from("properties")
      .select("id, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(5000);
    const base = getSiteUrl();
    const staticPages = [
      "",
      "/tenant",
      "/tenant/map",
      "/auth",
      "/landlord",
      "/pricing",
      "/privacy",
      "/terms-of-service",
      "/cookie-policy",
      "/refund-policy",
      "/data-deletion",
      "/acceptable-use-policy",
      "/landlord-agreement",
      "/contact",
      "/about",
    ];
    const urls = [
      ...staticPages.map(
        (p) =>
          `  <url><loc>${base}${p}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
      ),
      ...(properties ?? []).map(
        (p) =>
          `  <url><loc>${base}/tenant/property/${p.id}</loc><lastmod>${p.updated_at}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`,
      ),
    ].join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
    return new Response(xml, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  } catch {
    return new Response(
      '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      { headers: { "Content-Type": "application/xml" } },
    );
  }
}

async function handleEmailUnsubscribe(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response("Missing token", { status: 400 });
  }
  const { verifyUnsubscribeToken } = await import("@/lib/email/unsubscribe");
  const userId = await verifyUnsubscribeToken(token);
  if (!userId) {
    return new Response("Invalid or expired link", { status: 400 });
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("profiles")
    .update({ email_marketing_opt_in: false })
    .eq("id", userId);
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center">
    <h1>Unsubscribed</h1>
    <p>You will no longer receive marketing emails from NyumbaSearch.</p>
    <p>Transactional emails (password reset, payments, messages) will still be sent.</p>
  </body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

type RouteDef = {
  match: (url: URL, method: string) => boolean;
  run: (req: Request) => Promise<Response> | Response;
};

const ROUTES: RouteDef[] = [
  {
    match: (url, method) => url.pathname === "/api/mpesa/callback" && method === "POST",
    run: (req) =>
      withErrorHandler(
        "M-Pesa callback",
        req,
        handleMpesaCallback,
        () =>
          new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
      ),
  },
  {
    match: (url, method) =>
      (url.pathname === "/api/payments/webhook/pesapal" ||
        url.pathname === "/api/payments/webhook/paystack") &&
      (method === "POST" || method === "GET"),
    run: (req) => withErrorHandler("Pesapal webhook", req, handlePesapalIpn),
  },
  {
    match: (url, method) => url.pathname === "/api/payments/callback/card" && method === "GET",
    run: (req) =>
      withErrorHandler("Pesapal redirect", req, handleCardCallback, () =>
        Response.redirect(`${getSiteUrl()}/tenant/checkout?card=failed`, 302),
      ),
  },
  {
    match: (url, method) => url.pathname === "/api/cron/subscription-renewals" && method === "POST",
    run: (req) => withErrorHandler("Renewal cron", req, handleRenewalCronRoute),
  },
  {
    match: (url, method) => url.pathname === "/api/cron/daily" && method === "POST",
    run: (req) => withErrorHandler("Daily cron", req, handleDailyCronRoute),
  },
  {
    match: (url, method) => url.pathname === "/api/cron/weekly" && method === "POST",
    run: (req) => withErrorHandler("Weekly cron", req, handleWeeklyCronRoute),
  },
  {
    match: (url, method) => url.pathname === "/api/cron/monthly" && method === "POST",
    run: (req) => withErrorHandler("Monthly cron", req, handleMonthlyCronRoute),
  },
  {
    match: (url, method) =>
      url.pathname === "/api/whatsapp/webhook" && (method === "GET" || method === "POST"),
    run: (req) => withErrorHandler("WhatsApp webhook", req, handleWhatsAppWebhook),
  },
  {
    match: (url) => url.pathname.startsWith("/api/v1/"),
    run: (req) => withErrorHandler("API v1", req, handleV1Api),
  },
  {
    match: (url, method) => url.pathname === "/api/listings/health" && method === "GET",
    run: async () => {
      try {
        return await handleListingsHealth();
      } catch (err) {
        console.error("Listings health error:", err);
        return new Response(JSON.stringify({ ok: false, error: "health check failed" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
  },
  {
    match: (url, method) => url.pathname === "/api/listings" && method === "GET",
    run: (req) =>
      withPublicRateLimit(req, "search", (r) =>
        withErrorHandler("Listings API", r, handleListingsApi),
      ),
  },
  {
    match: (url, method) => url.pathname === "/api/stats/public" && method === "GET",
    run: (req) =>
      withPublicRateLimit(req, "api", async () => {
        try {
          return await handlePublicStatsApi();
        } catch (err) {
          console.error("Public stats error:", err);
          return new Response(JSON.stringify({ error: "stats unavailable" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
      }),
  },
  {
    match: (url, method) => url.pathname === "/api/testimonials" && method === "GET",
    run: (req) =>
      withPublicRateLimit(req, "api", async () => {
        try {
          return await handleTestimonialsApi();
        } catch (err) {
          console.error("Testimonials error:", err);
          return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json" },
          });
        }
      }),
  },
  {
    match: (url, method) => url.pathname === "/api/stats/intelligence" && method === "GET",
    run: (req) =>
      withPublicRateLimit(req, "api", async () => {
        try {
          return await handleIntelligenceStatsApi();
        } catch (err) {
          console.error("Intelligence stats error:", err);
          const { FALLBACK_INTELLIGENCE } = await import("@/lib/api/homepage-shared");
          return new Response(JSON.stringify(FALLBACK_INTELLIGENCE), {
            headers: { "Content-Type": "application/json" },
          });
        }
      }),
  },
  {
    match: (url, method) => url.pathname === "/api/agencies/featured" && method === "GET",
    run: (req) =>
      withPublicRateLimit(req, "api", async () => {
        try {
          return await handleFeaturedAgenciesApi();
        } catch (err) {
          console.error("Featured agencies error:", err);
          return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json" },
          });
        }
      }),
  },
  {
    match: (url, method) => url.pathname === "/api/health" && method === "GET",
    run: () => withErrorHandler("Health check", new Request("http://local"), handleHealthCheck),
  },
  {
    match: (url, method) => url.pathname === "/api/cookie-consent" && method === "POST",
    run: (req) => withErrorHandler("Cookie consent", req, handleCookieConsent),
  },
  {
    match: (url) => url.pathname === "/privacy-policy",
    run: () => Response.redirect(`${getSiteUrl()}/privacy`, 301),
  },
  {
    match: (url, method) => url.pathname === "/api/client-errors" && method === "POST",
    run: (req) => withErrorHandler("Client errors", req, handleClientErrors),
  },
  {
    match: (url, method) => url.pathname === "/api/health/connections" && method === "GET",
    run: async () => {
      try {
        return await handleHealthConnections();
      } catch (err) {
        console.error("Connections health error:", err);
        return new Response(JSON.stringify({ healthy: false, connections: [] }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
  },
  {
    match: (url, method) => url.pathname === "/api/ai/probe" && method === "GET",
    run: async () => {
      try {
        return await handleAiProbe();
      } catch (err) {
        console.error("AI probe error:", err);
        return new Response(JSON.stringify({ live: false, provider: "error", sample: "" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
  },
  {
    match: (url, method) => url.pathname === "/api/email/unsubscribe" && method === "GET",
    run: (req) => withErrorHandler("Email unsubscribe", req, handleEmailUnsubscribe),
  },
  {
    match: (url) => url.pathname === "/robots.txt",
    run: () => handleRobotsTxt(),
  },
  {
    match: (url) => url.pathname === "/sitemap.xml",
    run: () => handleSitemapXml(),
  },
];

/** Infrastructure routes (webhooks, health, sitemap) handled before TanStack SSR. */
export async function tryInfrastructureRoute(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  for (const route of ROUTES) {
    if (route.match(url, req.method)) {
      return await route.run(req);
    }
  }
  return null;
}
