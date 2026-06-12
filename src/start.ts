import { createStart, createMiddleware } from "@tanstack/react-start";

import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";
import { renderErrorPage } from "./lib/error-page";
import { getSiteUrl } from "./lib/site";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const isProduction = typeof process !== "undefined" && process.env.NODE_ENV === "production";
const isDevelopment = !isProduction;

const seoMiddleware = createMiddleware().server(async ({ request, next }) => {
  const url = new URL(request.url);

  if (url.pathname === "/api/mpesa/callback" && request.method === "POST") {
    try {
      const { parseStkCallback } = await import("./lib/api/mpesa");
      const body = (await request.json()) as import("./lib/api/mpesa").StkCallbackBody;
      const parsed = parseStkCallback(body);
      if (parsed) {
        const { supabaseAdmin } = await import("./integrations/supabase/client.server");
        type PaymentUpdate =
          import("./integrations/supabase/types").Database["public"]["Tables"]["payments"]["Update"];
        const patch: PaymentUpdate = {
          status: parsed.success ? "completed" : "failed",
        };
        if (parsed.mpesaReceipt) patch.mpesa_receipt = parsed.mpesaReceipt;

        const { data: payment } = await supabaseAdmin
          .from("payments")
          .update(patch)
          .eq("mpesa_checkout_id", parsed.checkoutRequestId)
          .eq("status", "pending")
          .select("property_id, payment_type, user_id")
          .maybeSingle();

        if (parsed.success && payment) {
          const { fulfillPayment } = await import("./lib/revenue/fulfill-payment");
          const { data: fullPayment } = await supabaseAdmin
            .from("payments")
            .select("amount_kes")
            .eq("mpesa_checkout_id", parsed.checkoutRequestId)
            .maybeSingle();

          await fulfillPayment(supabaseAdmin, {
            userId: payment.user_id,
            propertyId: payment.property_id,
            paymentType: payment.payment_type,
            amountKes: fullPayment?.amount_kes ?? 0,
          });

          if (payment.payment_type === "premium_subscription" && payment.user_id) {
            await supabaseAdmin
              .from("profiles")
              .update({ is_portal_active: true })
              .eq("id", payment.user_id);
          }
        }
      }
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("M-Pesa callback error:", err);
      return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (url.pathname === "/api/health/connections" && request.method === "GET") {
    try {
      const { checkConnections } = await import("./lib/api/connections-health");
      const connections = await checkConnections();
      const healthy = connections.every((c) => c.status !== "missing");
      return new Response(JSON.stringify({ healthy, connections }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Connections health error:", err);
      return new Response(JSON.stringify({ healthy: false, connections: [] }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (url.pathname === "/api/ai/probe" && request.method === "GET") {
    try {
      const { probeNyumbaAi } = await import("./lib/api/ai-client");
      const result = await probeNyumbaAi();
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("AI probe error:", err);
      return new Response(JSON.stringify({ live: false, provider: "error", sample: "" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (url.pathname === "/robots.txt") {
    const site = getSiteUrl();
    return new Response(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /landlord/dashboard\n\nSitemap: ${site}/sitemap.xml\n`,
      { headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  if (url.pathname === "/sitemap.xml") {
    try {
      const { createPublicClient } = await import("./lib/api/public-client");
      const supabase = createPublicClient();
      const { data: properties } = await supabase
        .from("properties")
        .select("id, updated_at")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(5000);
      const base = getSiteUrl();
      const staticPages = ["", "/tenant", "/tenant/map", "/auth", "/landlord"];
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
        {
          headers: { "Content-Type": "application/xml" },
        },
      );
    }
  }
  return await next();
});

// Build request middleware array so we can conditionally prepend dev helpers
const requestMiddlewareArr = [seoMiddleware, errorMiddleware];

// Dev-only: compute and return dev-mode server-fn id for a given file+export
if (isDevelopment) {
  requestMiddlewareArr.unshift(
    createMiddleware().server(async ({ request, next }) => {
      try {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/_serverFn/")) {
          const txt = await request
            .clone()
            .text()
            .catch(() => "<binary>");
          console.log("DEV DEBUG: /_serverFn/ raw body:", txt?.slice(0, 2000));
        }
      } catch (e) {
        console.error("DEV DEBUG: error reading server-fn body", e);
      }
      return await next();
    }),
  );

  const debugMiddleware = createMiddleware().server(async ({ request, next }) => {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/__debug/server-fn-id") {
        const file = url.searchParams.get("file") || "";
        const exp = url.searchParams.get("export") || "";
        const payload = { file, export: exp };
        const b = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
        const id = b.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
        return new Response(JSON.stringify({ id, payload }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.error("DEV DEBUG: server-fn-id endpoint error", e);
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return await next();
  });
  requestMiddlewareArr.unshift(debugMiddleware);
}

export const startInstance = createStart(() => ({
  requestMiddleware: requestMiddlewareArr,
  functionMiddleware: [attachSupabaseAuth],
}));
