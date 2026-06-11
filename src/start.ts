import { createStart, createMiddleware } from "@tanstack/react-start";

import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";
import { renderErrorPage } from "./lib/error-page";

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
  if (url.pathname === "/robots.txt") {
    return new Response(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /landlord/dashboard\n\nSitemap: https://nyumba-search.kevinbuluma1.workers.dev/sitemap.xml\n`,
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
      const base = "https://nyumba-search.kevinbuluma1.workers.dev";
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
      return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
        headers: { "Content-Type": "application/xml" },
      });
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
        const id = b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
