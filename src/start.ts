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

// Build request middleware array so we can conditionally prepend dev helpers
const requestMiddlewareArr = [errorMiddleware];

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
