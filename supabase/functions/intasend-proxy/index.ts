/**
 * Proxies IntaSend API calls from Cloudflare Workers.
 * IntaSend (behind Cloudflare) bans Worker egress IPs with error 1106.
 *
 * Auth: Authorization Bearer must match INTASEND_PROXY_SECRET (or CRON_SECRET).
 * Secrets: INTASEND_SECRET_KEY, INTASEND_ENV, INTASEND_PROXY_SECRET
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function intasendBases(): string[] {
  const env = (Deno.env.get("INTASEND_ENV") || "live").toLowerCase();
  if (env === "sandbox") return ["https://sandbox.intasend.com/api/v1"];
  return ["https://payment.intasend.com/api/v1", "https://api.intasend.com/api/v1"];
}

function authorizeRequest(req: Request): Response | null {
  const expected =
    Deno.env.get("INTASEND_PROXY_SECRET")?.trim() || Deno.env.get("CRON_SECRET")?.trim();
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!expected || token !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}

function publishableKey(): string | null {
  return (
    Deno.env.get("INTASEND_PUBLISHABLE_KEY")?.trim() ||
    Deno.env.get("INTASEND_PUBLIC_KEY")?.trim() ||
    null
  );
}

function buildUpstreamBody(
  payloadBody: unknown,
  method: string,
  pub: string | null,
): string | undefined {
  if (payloadBody == null || method === "GET" || method === "HEAD") return undefined;

  const bodyObj =
    typeof payloadBody === "object" && payloadBody !== null && !Array.isArray(payloadBody)
      ? { ...(payloadBody as Record<string, unknown>) }
      : payloadBody;

  if (pub && typeof bodyObj === "object" && bodyObj !== null && !Array.isArray(bodyObj)) {
    (bodyObj as Record<string, unknown>).public_key =
      (bodyObj as Record<string, unknown>).public_key || pub;
  }
  return JSON.stringify(bodyObj);
}

async function forwardToIntasend(opts: {
  path: string;
  method: string;
  secret: string;
  pub: string | null;
  bodyText?: string;
}): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.secret}`,
    Accept: "application/json",
    "User-Agent": "NyumbaSearch-IntasendProxy/1.0",
  };
  if (opts.method !== "GET" && opts.method !== "HEAD") {
    headers["Content-Type"] = "application/json";
  }
  if (opts.pub) headers.INTASEND_PUBLIC_API_KEY = opts.pub;

  let lastStatus = 0;
  let lastText = "";
  for (const base of intasendBases()) {
    const res = await fetch(`${base}${opts.path}`, {
      method: opts.method,
      headers,
      body: opts.bodyText,
    });
    const text = await res.text();
    lastStatus = res.status;
    lastText = text;
    if (res.ok) {
      return new Response(text, {
        status: res.status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    // Retry alternate host on auth / block / 5xx
    if (res.status !== 401 && res.status !== 403 && res.status < 500) {
      break;
    }
  }

  return new Response(lastText || JSON.stringify({ error: "IntaSend request failed" }), {
    status: lastStatus || 502,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const authError = authorizeRequest(req);
  if (authError) return authError;

  const secret = Deno.env.get("INTASEND_SECRET_KEY")?.trim();
  if (!secret) {
    return json({ error: "INTASEND_SECRET_KEY not configured on edge function" }, 500);
  }

  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  let payload: { path?: string; method?: string; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const path = String(payload.path || "");
  if (!path.startsWith("/") || path.includes("://") || path.includes("..")) {
    return json({ error: "Invalid path" }, 400);
  }

  const method = (payload.method || "POST").toUpperCase();
  const pub = publishableKey();
  const bodyText = buildUpstreamBody(payload.body, method, pub);

  return forwardToIntasend({ path, method, secret, pub, bodyText });
});
