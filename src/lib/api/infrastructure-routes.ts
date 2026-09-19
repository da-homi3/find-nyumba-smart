import { getSiteUrl } from "@/lib/site";
import {
  applyRateLimitHeaders,
  rateLimitDistributed,
  rateLimitKeyFromHeaders,
  RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { withCache } from "@/lib/cache/manager";
import { withEdgeCache } from "@/lib/cache/edge-cache";
import { normalizeNeighborhoodFilter } from "@/lib/security/neighborhoods";
import type { PropertySearchFilters } from "@/lib/properties";
import { buildFullSitemapXml, buildStaticSitemapXml, sitemapResponse } from "@/lib/seo/sitemap";
import { buildRobotsTxt } from "@/lib/seo/robots";
import { buildLlmsTxt } from "@/lib/seo/llms";
import { INDEXNOW_KEY, indexNowKeyPath } from "@/lib/seo/indexnow";
import { isServerEnvConfigured, getServerEnv } from "@/lib/server-env";
import type { Json } from "@/integrations/supabase/types";

type RouteHandler = (request: Request, ctx?: ExecutionContext) => Promise<Response>;

function normalizeSeoPath(pathname: string): string {
  let path = pathname.toLowerCase();
  while (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path || "/";
}

function withPublicRateLimit(
  req: Request,
  endpoint: keyof typeof RATE_LIMITS,
  handler: RouteHandler,
  ctx?: ExecutionContext,
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
    return handler(req, ctx).then((res) => {
      const headers = new Headers(res.headers);
      headers.set("X-Cache", headers.get("X-Cache") ?? "MISS");
      return applyRateLimitHeaders(new Response(res.body, { status: res.status, headers }), result);
    });
  });
}

async function withErrorHandler(
  label: string,
  req: Request,
  handler: RouteHandler,
  onError?: () => Response,
  ctx?: ExecutionContext,
): Promise<Response> {
  try {
    return await handler(req, ctx);
  } catch (err) {
    console.error(`${label} error:`, err);
    if (onError) return onError();
    return new Response(JSON.stringify({ error: "Request failed", code: "INTERNAL" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleMapboxTokenApi(): Promise<Response> {
  const fromEnv =
    process.env.MAPBOX_PUBLIC_TOKEN?.trim() ?? process.env.VITE_MAPBOX_TOKEN?.trim() ?? "";
  const enabled = fromEnv.startsWith("pk.");
  return new Response(JSON.stringify({ token: enabled ? fromEnv : null, enabled }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
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

async function handleDailyPmCronRoute(req: Request): Promise<Response> {
  const { handleDailyPmCron } = await import("@/lib/payments/webhook-handlers");
  return handleDailyPmCron(req);
}

async function handleDailyMarketingCronRoute(req: Request): Promise<Response> {
  const { handleDailyMarketingCron } = await import("@/lib/payments/webhook-handlers");
  return handleDailyMarketingCron(req);
}

async function handleSubscriptionInvoiceCronRoute(req: Request): Promise<Response> {
  const { handleSubscriptionInvoiceCron } = await import("@/lib/payments/webhook-handlers");
  return handleSubscriptionInvoiceCron(req);
}

async function handleWeeklyCronRoute(req: Request): Promise<Response> {
  const { handleWeeklyCron } = await import("@/lib/payments/webhook-handlers");
  return handleWeeklyCron(req);
}

async function handleMonthlyCronRoute(req: Request): Promise<Response> {
  const { handleMonthlyCron } = await import("@/lib/payments/webhook-handlers");
  return handleMonthlyCron(req);
}

function cronRunStatus(
  ok: boolean,
  detail: Record<string, unknown>,
): "succeeded" | "failed" | "partial" {
  if (!ok) return "failed";
  const failedCount = typeof detail.failed === "number" ? detail.failed : 0;
  const hasErrors = Array.isArray(detail.errors) && detail.errors.length > 0;
  return failedCount > 0 || hasErrors ? "partial" : "succeeded";
}

async function runTrackedCron(
  jobName: string,
  req: Request,
  handler: RouteHandler,
): Promise<Response> {
  const startedAt = new Date();
  let response: Response | undefined;
  let detail: Record<string, unknown> = {};
  let status: "succeeded" | "failed" | "partial" = "failed";
  try {
    response = await handler(req);
    detail = await response
      .clone()
      .json()
      .then((value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {},
      )
      .catch(() => ({}));
    status = cronRunStatus(response.ok, detail);
    return response;
  } finally {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("cron_run_log").insert({
        job_name: jobName,
        status,
        http_status: response?.status ?? null,
        duration_ms: Date.now() - startedAt.getTime(),
        detail: structuredClone(detail) as Json,
        started_at: startedAt.toISOString(),
      });
      if (jobName === "daily") {
        await supabaseAdmin
          .from("cron_run_log")
          .delete()
          .lt("finished_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
      }
    } catch (logError) {
      console.error("[cron] failed to persist run result", jobName, logError);
    }
  }
}

async function handleWhatsAppWebhook(req: Request): Promise<Response> {
  const { handleWhatsAppWebhookRequest } = await import("@/lib/whatsapp/webhook");
  return handleWhatsAppWebhookRequest(req);
}

async function handleV1Api(req: Request): Promise<Response> {
  const { handleV1Api } = await import("@/lib/api/v1/router");
  return handleV1Api(req);
}

async function handleMobileV1ApiRoute(req: Request): Promise<Response> {
  const { handleMobileV1Api } = await import("@/lib/api/mobile/v1/router");
  return handleMobileV1Api(req);
}

type PropertyTypeParser = {
  safeParse(
    value: string,
  ):
    | { success: true; data: NonNullable<PropertySearchFilters["propertyType"]> }
    | { success: false };
};

function optionalNumber(params: URLSearchParams, key: string): number | undefined {
  const value = params.get(key);
  return value ? Number(value) : undefined;
}

function finiteNumber(params: URLSearchParams, key: string): number | undefined {
  const value = Number(params.get(key) ?? Number.NaN);
  return Number.isFinite(value) ? value : undefined;
}

function parsePropertyTypes(
  raw: string | null,
  parser: PropertyTypeParser,
): PropertySearchFilters["propertyTypes"] {
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((value) => parser.safeParse(value.trim()))
    .flatMap((result) => (result.success ? [result.data] : []));
  return values.length > 0 ? values : undefined;
}

function parseSortBy(value: string | null): PropertySearchFilters["sortBy"] {
  const supported = new Set(["nearby", "newest", "price_asc", "price_desc", "score"]);
  return supported.has(value ?? "")
    ? (value as NonNullable<PropertySearchFilters["sortBy"]>)
    : "newest";
}

function parseBounds(params: URLSearchParams): PropertySearchFilters["bounds"] {
  const minLat = finiteNumber(params, "minLat");
  const maxLat = finiteNumber(params, "maxLat");
  const minLng = finiteNumber(params, "minLng");
  const maxLng = finiteNumber(params, "maxLng");
  if (
    minLat === undefined ||
    maxLat === undefined ||
    minLng === undefined ||
    maxLng === undefined
  ) {
    return undefined;
  }
  return { minLat, maxLat, minLng, maxLng };
}

function parseListingFilters(
  url: URL,
  propertyTypeParser: PropertyTypeParser,
): PropertySearchFilters {
  const params = url.searchParams;
  const parsedType = propertyTypeParser.safeParse(params.get("type") ?? "");
  const pricingModeRaw = params.get("pricingMode");
  const pricingMode =
    pricingModeRaw === "rent" || pricingModeRaw === "sale" ? pricingModeRaw : undefined;

  return {
    limit: Math.trunc(finiteNumber(params, "limit") ?? 50),
    offset: Math.trunc(finiteNumber(params, "offset") ?? 0),
    query: params.get("q") ?? undefined,
    neighborhood: normalizeNeighborhoodFilter(params.get("neighborhood")),
    locationId: params.get("locationId") ?? undefined,
    countyLocationId: params.get("countyLocationId") ?? undefined,
    constituencyLocationId: params.get("constituencyLocationId") ?? undefined,
    wardLocationId: params.get("wardLocationId") ?? undefined,
    propertyType: parsedType.success ? parsedType.data : undefined,
    propertyTypes: parsePropertyTypes(params.get("types"), propertyTypeParser),
    pricingMode,
    minRent: optionalNumber(params, "minRent"),
    maxRent: optionalNumber(params, "maxRent"),
    verifiedOnly: params.get("verifiedOnly") === "1",
    minBedrooms: optionalNumber(params, "minBedrooms"),
    sortBy: parseSortBy(params.get("sortBy")),
    originLat: finiteNumber(params, "originLat"),
    originLng: finiteNumber(params, "originLng"),
    bounds: parseBounds(params),
  };
}

async function handleListingsApi(req: Request, ctx?: ExecutionContext): Promise<Response> {
  const { getListingsCacheEpoch } = await import("@/lib/cache/manager");
  const epoch = await getListingsCacheEpoch();
  const cacheUrl = new URL(req.url);
  cacheUrl.searchParams.set("_e", String(epoch));

  return withEdgeCache(
    req,
    ctx,
    async () => {
      const url = new URL(req.url);
      const { queryListings } = await import("@/lib/api/listings-core");
      const { propertyTypeSchema } = await import("@/lib/api/nyumba/nyumba-shared");
      const filters = parseListingFilters(url, propertyTypeSchema);

      const started = Date.now();
      const result = await queryListings(filters);
      console.log(
        JSON.stringify({
          event: "listings_api",
          items: result.items.length,
          total: result.total,
          limit: filters.limit,
          sortBy: filters.sortBy,
          ms: Date.now() - started,
        }),
      );
      return new Response(JSON.stringify(result), {
        headers: {
          "Content-Type": "application/json",
          // Edge + browser SWR — cache key includes listings epoch so uploads bust colo cache.
          "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
        },
      });
    },
    { cacheKeyUrl: cacheUrl.toString() },
  );
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
  const { data, cacheHit } = await withCache(
    "intelligence_stats",
    "intelligence_stats",
    async () => {
      const { loadPropertyIntelligenceStats } = await import("@/lib/api/homepage.functions");
      return loadPropertyIntelligenceStats();
    },
  );
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
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) {
    return new Response(JSON.stringify({ error: "Payload too large", code: "PAYLOAD_TOO_LARGE" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return new Response(JSON.stringify({ error: "Invalid payload", code: "VALIDATION" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const sanitized = {
    message:
      typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message.slice(0, 500)
        : "Client error",
    path:
      typeof (body as { path?: unknown }).path === "string"
        ? (body as { path: string }).path.slice(0, 300)
        : undefined,
    userAgent: req.headers.get("user-agent")?.slice(0, 300),
  };
  console.error("[client-error]", JSON.stringify(sanitized));
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
  const configured = isServerEnvConfigured([
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE",
    "MPESA_PASSKEY",
  ]);
  return { name: "mpesa_config", status: configured ? "ok" : "missing" };
}

function checkAiConfig(): { name: string; status: string } {
  const gemini = Boolean(getServerEnv("GEMINI_API_KEY") || getServerEnv("GOOGLE_AI_API_KEY"));
  const workers = Boolean((globalThis as { __env__?: { AI?: unknown } }).__env__?.AI);
  if (gemini || workers) return { name: "ai_config", status: "ok" };
  return { name: "ai_config", status: "missing" };
}

async function checkPesapalLive(): Promise<{ name: string; status: string; error?: string }> {
  const configured = isServerEnvConfigured([
    "PESAPAL_CONSUMER_KEY",
    "PESAPAL_CONSUMER_SECRET",
    "PESAPAL_NOTIFICATION_ID",
  ]);
  if (!configured) return { name: "pesapal", status: "missing" };
  try {
    const { probePesapalAuth } = await import("@/lib/api/pesapal");
    const ok = await probePesapalAuth();
    return { name: "pesapal", status: ok ? "ok" : "error" };
  } catch (e) {
    return {
      name: "pesapal",
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function handleHealthCheck(): Promise<Response> {
  const start = Date.now();
  const checks = await Promise.all([
    checkSupabaseHealth(),
    checkKvHealth(),
    Promise.resolve(checkMpesaConfig()),
    checkPesapalLive(),
    Promise.resolve(checkAiConfig()),
  ]);

  const healthy = checks.find((check) => check.name === "supabase_listings")?.status === "ok";
  const durationMs = Date.now() - start;

  return new Response(
    JSON.stringify({
      status: healthy ? "ready" : "not_ready",
      checks: checks.map(({ name, status }) => ({ name, status })),
      durationMs,
      timestamp: new Date().toISOString(),
    }),
    {
      status: healthy ? 200 : 503,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function handleLiveness(): Response {
  return new Response(
    JSON.stringify({
      status: "ok",
      service: "nyumbasearch",
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
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

async function handleAiChat(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  const body = (await req.json().catch(() => null)) as {
    message?: string;
    propertyId?: string;
  } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) {
    return new Response(JSON.stringify({ error: "message required (1–2000 chars)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const propertyId =
    typeof body?.propertyId === "string" && body.propertyId.length > 0
      ? body.propertyId
      : undefined;

  const { requireMobileBearer } = await import("@/lib/api/mobile/v1/auth");
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) {
    return new Response(
      JSON.stringify({
        error: "unauthorized",
        reply: "Sign in and upgrade to Tenant Plus to use NyumbaSearch AI.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const { requirePlus, PlusRequiredError, plusRequiredPayload } =
    await import("@/lib/payments/require-plus");
  try {
    await requirePlus(auth.admin, auth.userId);
  } catch (err) {
    if (err instanceof PlusRequiredError) {
      return new Response(
        JSON.stringify({
          ...plusRequiredPayload(),
          reply: "NyumbaSearch AI is a Tenant Plus feature. Upgrade to continue.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
    throw err;
  }

  const { TENANT_PLUS_CONFIG } = await import("@/lib/revenue/tenant-plus-config");
  const { checkRateLimit } = await import("@/lib/api/rate-limit");
  checkRateLimit(`ai-user:${auth.userId}`, {
    max: TENANT_PLUS_CONFIG.aiRequestsPerMinute,
    windowMs: 60_000,
  });
  const { logAiUsage } = await import("@/lib/ai/usage-log");
  logAiUsage({ userId: auth.userId, feature: "property-chat", ok: true });

  const { answerPropertyAiChat } = await import("@/lib/api/ai.functions");
  const reply = await answerPropertyAiChat({ message, propertyId });
  return new Response(JSON.stringify({ reply }), {
    headers: { "Content-Type": "application/json" },
  });
}

function handleRobotsTxt(): Response {
  return new Response(buildRobotsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

async function handleLlmsTxt(): Promise<Response> {
  const body = await buildLlmsTxt();
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

async function handleSitemapXml(): Promise<Response> {
  try {
    const { data: xml, cacheHit } = await withCache(
      "sitemap_xml_v5",
      "sitemap_xml",
      buildFullSitemapXml,
    );
    return sitemapResponse(xml, cacheHit);
  } catch (error) {
    console.error("[sitemap] fallback to static:", error);
    return sitemapResponse(buildStaticSitemapXml());
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
  await supabaseAdmin.from("profiles").update({ email_marketing_opt_in: false }).eq("id", userId);
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center">
    <h1>Unsubscribed</h1>
    <p>You will no longer receive marketing emails from NyumbaSearch.</p>
    <p>Transactional emails (password reset, payments, messages) will still be sent.</p>
  </body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

type RouteDef = {
  match: (url: URL, method: string) => boolean;
  run: (req: Request, ctx?: ExecutionContext) => Promise<Response> | Response;
};


async function upsertBrandedPilotRow(
  supabaseAdmin: { from: (t: string) => any },
  opts: {
    existing: { id: string } | null;
    partnerName: string;
    to: string;
    slug: string;
    start: Date;
    end: Date;
  },
) {
  if (!opts.existing) {
    const { data: created, error } = await supabaseAdmin
      .from("pilot_partnerships")
      .insert({
        partner_name: opts.partnerName,
        partner_type: "REAL_ESTATE_AGENCY",
        primary_contact_email: opts.to,
        primary_contact_name: `${opts.partnerName} Team`,
        status: "INVITED",
        pilot_start_date: opts.start.toISOString().slice(0, 10),
        pilot_end_date: opts.end.toISOString().slice(0, 10),
        pilot_duration_days: 30,
        public_slug: opts.slug,
        show_partner_badge: true,
        notes: `Branded pilot invite for ${opts.partnerName}`,
        objectives: [],
        success_criteria: [],
        onboarding: { brandedInvite: true },
      })
      .select("*")
      .single();
    if (error) throw error;
    return created;
  }
  const { data: updated, error } = await supabaseAdmin
    .from("pilot_partnerships")
    .update({
      partner_name: opts.partnerName,
      primary_contact_email: opts.to,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.existing.id)
    .select("*")
    .single();
  if (error) throw error;
  return updated;
}

async function handleBrandedPilotInviteOps(req: Request): Promise<Response> {
      const secret = process.env.CRON_SECRET;
      const auth = req.headers.get("authorization");
      if (!secret || auth !== `Bearer ${secret}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const body = (await req.json()) as {
          to?: string;
          partnerName?: string;
          slug?: string;
          preview?: boolean;
        };
        const to = body.to?.trim().toLowerCase();
        const partnerName = body.partnerName?.trim() || "Azizi Realtors";
        const slug = (body.slug?.trim() || "azizi-realtors").toLowerCase();
        if (!to?.includes("@")) {
          return new Response(JSON.stringify({ error: "Missing recipient email" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendEmailResult } = await import("@/lib/email/send");
        const { brandedPartnerPilotInviteEmail } = await import(
          "@/lib/email/branded-partner-pilot-invite"
        );
        const { getSiteUrl } = await import("@/lib/site");
        const { createHash, randomUUID } = await import("node:crypto");

        const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");
        const rawToken = `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`;
        const site = getSiteUrl().replace(/\/$/, "");
        const start = new Date();
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 30);

        const { data: existing } = await supabaseAdmin
          .from("pilot_partnerships")
          .select("*")
          .eq("public_slug", slug)
          .maybeSingle();

        const pilot = await upsertBrandedPilotRow(supabaseAdmin, {
          existing,
          partnerName,
          to,
          slug,
          start,
          end,
        });

        await supabaseAdmin
          .from("pilot_invitations")
          .update({ status: "EXPIRED" })
          .eq("pilot_id", pilot.id)
          .eq("status", "PENDING");

        const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const { error: inviteError } = await supabaseAdmin.from("pilot_invitations").insert({
          pilot_id: pilot.id,
          email: to,
          token_hash: hashToken(rawToken),
          expires_at: expires.toISOString(),
        });
        if (inviteError) throw inviteError;

        const inviteUrl = `${site}/invite/${slug}`;
        const tpl = brandedPartnerPilotInviteEmail({
          partnerName,
          inviteUrl,
          displayInviteUrl: `${site.replace(/^https?:\/\//, "")}/invite/${slug}`,
          subject: `Welcome to NyumbaSearch — ${partnerName} Pilot Program`,
          previewBanner: body.preview
            ? "This is a design preview only. Not the final partner send."
            : undefined,
        });

        const sent = await sendEmailResult({
          to,
          templateId: "branded-partner-pilot-invite",
          ...tpl,
          metadata: { pilotId: pilot.id, slug, preview: Boolean(body.preview) },
        });

        const failReason = !sent.ok && "reason" in sent ? sent.reason : undefined;

        return new Response(
          JSON.stringify({
            ok: sent.ok,
            reason: failReason,
            pilotId: pilot.id,
            inviteUrl,
            to,
            subject: tpl.subject,
          }),
          {
            status: sent.ok ? 200 : 502,
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (err) {
        console.error("[ops] branded pilot invite failed", err);
        return new Response(
          JSON.stringify({ error: err instanceof Error ? err.message : "send failed" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
}

const ROUTES: RouteDef[] = [
  {
    match: (url, method) => url.pathname === "/api/mpesa/callback" && method === "POST",
    run: (req) =>
      withPublicRateLimit(req, "mpesa", (r) =>
        withErrorHandler(
          "M-Pesa callback",
          r,
          handleMpesaCallback,
          () =>
            new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }),
        ),
      ),
  },
  {
    match: (url, method) =>
      url.pathname === "/api/payments/webhook/pesapal" && (method === "POST" || method === "GET"),
    run: (req) =>
      withPublicRateLimit(req, "pesapal", (r) =>
        withErrorHandler("Pesapal webhook", r, handlePesapalIpn),
      ),
  },
  {
    // Paystack retired — card checkout uses Pesapal. Keep path for old bookmarks/dashboards.
    match: (url, method) =>
      url.pathname === "/api/payments/webhook/paystack" && (method === "POST" || method === "GET"),
    run: async () =>
      new Response(
        JSON.stringify({
          error: "Paystack webhooks are retired. Card payments use Pesapal.",
          code: "PAYSTACK_RETIRED",
        }),
        { status: 410, headers: { "Content-Type": "application/json" } },
      ),
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
    run: (req) =>
      withErrorHandler("Renewal cron", req, (r) =>
        runTrackedCron("subscription-renewals", r, handleRenewalCronRoute),
      ),
  },
  {
    match: (url, method) => url.pathname === "/api/cron/daily" && method === "POST",
    run: (req) =>
      withErrorHandler("Daily cron", req, (r) => runTrackedCron("daily", r, handleDailyCronRoute)),
  },
  {
    match: (url, method) => url.pathname === "/api/cron/daily-pm" && method === "POST",
    run: (req) =>
      withErrorHandler("Daily PM cron", req, (r) =>
        runTrackedCron("daily-pm", r, handleDailyPmCronRoute),
      ),
  },
  {
    match: (url, method) => url.pathname === "/api/cron/daily-marketing" && method === "POST",
    run: (req) =>
      withErrorHandler("Daily marketing cron", req, (r) =>
        runTrackedCron("daily-marketing", r, handleDailyMarketingCronRoute),
      ),
  },
  {
    match: (url, method) => url.pathname === "/api/cron/subscription-invoices" && method === "POST",
    run: (req) =>
      withErrorHandler("Subscription invoice cron", req, (r) =>
        runTrackedCron("subscription-invoices", r, handleSubscriptionInvoiceCronRoute),
      ),
  },
  {
    match: (url, method) => url.pathname === "/api/cron/weekly" && method === "POST",
    run: (req) =>
      withErrorHandler("Weekly cron", req, (r) =>
        runTrackedCron("weekly", r, handleWeeklyCronRoute),
      ),
  },
  {
    match: (url, method) => url.pathname === "/api/cron/monthly" && method === "POST",
    run: (req) =>
      withErrorHandler("Monthly cron", req, (r) =>
        runTrackedCron("monthly", r, handleMonthlyCronRoute),
      ),
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
    run: (req, ctx) =>
      withPublicRateLimit(
        req,
        "search",
        (r, c) => withErrorHandler("Listings API", r, handleListingsApi, undefined, c),
        ctx,
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
    run: async () => handleLiveness(),
  },
  {
    match: (url, method) => url.pathname === "/api/ready" && method === "GET",
    run: (req) => withErrorHandler("Readiness check", req, handleHealthCheck),
  },
  {
    match: (url, method) => url.pathname === "/api/mapbox-token" && method === "GET",
    run: (req) =>
      withPublicRateLimit(req, "api", async () => {
        try {
          return await handleMapboxTokenApi();
        } catch (err) {
          console.error("Mapbox token error:", err);
          return new Response(JSON.stringify({ token: null, enabled: false }), {
            headers: { "Content-Type": "application/json" },
          });
        }
      }),
  },
  {
    match: (url, method) => url.pathname.startsWith("/api/locations") && method === "GET",
    run: (req) =>
      withPublicRateLimit(req, "api", async (r) => {
        const { handleLocationsApi } = await import("@/lib/locations/http");
        return handleLocationsApi(r);
      }),
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
    match: (url) => url.pathname === "/terms" || url.pathname === "/terms-of-use",
    run: () => Response.redirect(`${getSiteUrl()}/terms-of-service`, 301),
  },
  {
    match: (url, method) => url.pathname === "/api/client-errors" && method === "POST",
    run: (req, ctx) =>
      withPublicRateLimit(
        req,
        "api",
        (rateLimitedReq) => withErrorHandler("Client errors", rateLimitedReq, handleClientErrors),
        ctx,
      ),
  },
  {
    match: (url, method) => url.pathname === "/api/health/connections" && method === "GET",
    run: async (req) => {
      const secret = process.env.CRON_SECRET;
      const auth = req.headers.get("authorization");
      if (!secret || auth !== `Bearer ${secret}`) {
        return new Response("Unauthorized", { status: 401 });
      }
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
    match: (url, method) => url.pathname === "/api/health/intasend-stk" && method === "GET",
    run: async (req) => {
      const secret = process.env.CRON_SECRET;
      const auth = req.headers.get("authorization");
      if (!secret || auth !== `Bearer ${secret}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const { probeIntasendFromWorker } = await import("@/lib/pm/intasend-collect");
        const url = new URL(req.url);
        const phone = url.searchParams.get("phone") || undefined;
        const amountRaw = url.searchParams.get("amount");
        const amountKes = amountRaw ? Number.parseInt(amountRaw, 10) : undefined;
        const report = await probeIntasendFromWorker({
          phone254: phone || undefined,
          amountKes: Number.isFinite(amountKes) ? amountKes : undefined,
        });
        return new Response(JSON.stringify(report, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("IntaSend health probe error:", err);
        return new Response(
          JSON.stringify({
            error: err instanceof Error ? err.message : "probe failed",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    },
  },
  {
    match: (url, method) => url.pathname === "/api/health/intasend-sync-rent" && method === "POST",
    run: async (req) => {
      const secret = process.env.CRON_SECRET;
      const auth = req.headers.get("authorization");
      if (!secret || auth !== `Bearer ${secret}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncMpesaPaymentStatus } = await import("@/lib/payments/complete-mpesa-payment");
        const { data: rows, error } = await supabaseAdmin
          .from("payments")
          .select("*")
          .eq("payment_type", "rent_payment")
          .eq("status", "pending")
          .not("mpesa_checkout_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(15);
        if (error) throw error;
        const results = [];
        for (const row of rows ?? []) {
          const synced = await syncMpesaPaymentStatus(supabaseAdmin, row);
          results.push({
            id: synced.id,
            checkout: synced.mpesa_checkout_id,
            status: synced.status,
            receipt: synced.mpesa_receipt,
          });
        }
        return new Response(JSON.stringify({ ok: true, results }, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("IntaSend rent sync error:", err);
        return new Response(
          JSON.stringify({ error: err instanceof Error ? err.message : "sync failed" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    },
  },
  {
    match: (url, method) => url.pathname === "/api/ai/probe" && method === "GET",
    run: async (req) => {
      const secret = process.env.CRON_SECRET;
      const auth = req.headers.get("authorization");
      if (!secret || auth !== `Bearer ${secret}`) {
        return new Response("Unauthorized", { status: 401 });
      }
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
    match: (url, method) => url.pathname === "/api/ai/chat" && method === "POST",
    run: (req) =>
      withPublicRateLimit(req, "ai", (r) =>
        withErrorHandler(
          "AI chat",
          r,
          handleAiChat,
          () =>
            new Response(
              JSON.stringify({
                reply:
                  "Please try that question once more — or contact the landlord using the buttons below.",
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        ),
      ),
  },
  {
    match: (url, method) => url.pathname === "/api/email/unsubscribe" && method === "GET",
    run: (req) => withErrorHandler("Email unsubscribe", req, handleEmailUnsubscribe),
  },
  {
    match: (url, method) =>
      url.pathname === "/api/maintenance/respond" && (method === "GET" || method === "POST"),
    run: (req) =>
      withErrorHandler("Maintenance respond", req, async (r) => {
        const { handleMaintenanceProviderRespond } =
          await import("@/lib/api/pm-maintenance.functions");
        return handleMaintenanceProviderRespond(r);
      }),
  },
  {
    match: (url) => normalizeSeoPath(url.pathname) === "/robots.txt",
    run: () => handleRobotsTxt(),
  },
  {
    match: (url) => normalizeSeoPath(url.pathname) === "/llms.txt",
    run: () => handleLlmsTxt(),
  },
  {
    match: (url) => normalizeSeoPath(url.pathname) === "/.well-known/llms.txt",
    run: () => handleLlmsTxt(),
  },
  {
    match: (url) => normalizeSeoPath(url.pathname) === "/sitemap.xml",
    run: (req) =>
      withErrorHandler("Sitemap", req, handleSitemapXml, () =>
        sitemapResponse(buildStaticSitemapXml()),
      ),
  },
  {
    match: (url) => normalizeSeoPath(url.pathname) === indexNowKeyPath().toLowerCase(),
    run: () =>
      new Response(`${INDEXNOW_KEY}\n`, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
        },
      }),
  },
  {
    // Flutter Mobile BFF (Tenant MVP) — additive; does not replace website createServerFn APIs.
    match: (url) => url.pathname.startsWith("/api/mobile/v1/"),
    run: (req) => withErrorHandler("Mobile BFF v1", req, handleMobileV1ApiRoute),
  },
  {
    match: (url, method) => url.pathname === "/api/mobile/fcm-token" && method === "POST",
    run: async (req) => {
      const { handleFcmTokenRequest } = await import("@/lib/api/mobile-fcm");
      return handleFcmTokenRequest(req);
    },
  },
  {
    match: (url, method) => url.pathname === "/api/promo/status" && method === "GET",
    run: async () => {
      const { handlePromoStatusApi } = await import("@/lib/api/promo.functions");
      return handlePromoStatusApi();
    },
  },
  {
    match: (url, method) => url.pathname === "/api/presence/ws" && method === "GET",
    run: async (req) => {
      const { forwardPresenceWebSocket } = await import("@/lib/presence/server");
      return forwardPresenceWebSocket(req);
    },
  },
  {
    match: (url) => normalizeSeoPath(url.pathname) === "/.well-known/assetlinks.json",
    run: async () =>
      new Response(ANDROID_ASSETLINKS_JSON, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
        },
      }),
  },
  {
    match: (url) => normalizeSeoPath(url.pathname) === "/.well-known/apple-app-site-association",
    run: async () =>
      new Response(appleAppSiteAssociationJson(), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
        },
      }),
  },
  {
    match: (url, method) =>
      url.pathname === "/api/ops/send-branded-pilot-invite" && method === "POST",
    run: handleBrandedPilotInviteOps,
  },
];

/** Digital Asset Links for Android App Links (upload/release keystore SHA-256).
 * After Play App Signing is enrolled, also add the Play Console "App signing key certificate" SHA-256. */
const ANDROID_ASSETLINKS_JSON = `[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "ke.co.nyumbasearch.app",
      "sha256_cert_fingerprints": [
        "9C:B0:AD:13:B0:AC:FF:F9:F9:7E:54:72:A6:8B:9C:7F:54:4D:24:25:37:A5:CC:97:A2:82:DF:C2:FD:35:81:58"
      ]
    }
  }
]`;

/**
 * Apple App Site Association for iOS Universal Links.
 * Set APPLE_TEAM_ID in Worker env (or sync-wrangler) before App Store submission.
 */
function appleAppSiteAssociationJson(): string {
  const teamId = (process.env.APPLE_TEAM_ID ?? "TEAMID").trim() || "TEAMID";
  return JSON.stringify({
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.ke.co.nyumbasearch.app`,
          paths: [
            "/tenant/*",
            "/tenant/property/*",
            "/property/*",
            "/invite/*",
            "/partner/invite/*",
            "/partner/*",
            "/auth/*",
            "/plus",
            "/services/*",
            "/caretaker/*",
            "/referrals",
            "/agency/*",
            "/manager/*",
            "/landlord/*",
            "/admin/*",
            "/verify/*",
            "/messages/*",
            "/compare",
          ],
        },
      ],
    },
  });
}

/** Infrastructure routes (webhooks, health, sitemap) handled before TanStack SSR. */
export async function tryInfrastructureRoute(
  req: Request,
  ctx?: ExecutionContext,
): Promise<Response | null> {
  const url = new URL(req.url);
  for (const route of ROUTES) {
    if (route.match(url, req.method)) {
      return await route.run(req, ctx);
    }
  }
  return null;
}
