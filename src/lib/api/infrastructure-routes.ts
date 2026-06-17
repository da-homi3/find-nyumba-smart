import { getSiteUrl } from "@/lib/site";

type RouteHandler = (request: Request) => Promise<Response>;

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
    const staticPages = ["", "/tenant", "/tenant/map", "/auth", "/landlord", "/pricing"];
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

type RouteDef = {
  match: (url: URL, method: string) => boolean;
  run: (req: Request) => Promise<Response> | Response;
};

const ROUTES: RouteDef[] = [
  {
    match: (url, method) => url.pathname === "/api/mpesa/callback" && method === "POST",
    run: (req) =>
      withErrorHandler("M-Pesa callback", req, handleMpesaCallback, () =>
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
