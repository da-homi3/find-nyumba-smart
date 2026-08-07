/**
 * Call IntaSend via Supabase Edge Function when Cloudflare Workers are IP-banned (error 1106).
 */
import { getServerEnv } from "@/lib/server-env";

export function intasendProxyConfigured(): boolean {
  const url = proxyUrl();
  const secret = proxySecret();
  return Boolean(url && secret);
}

function proxyUrl(): string | null {
  const explicit = getServerEnv("INTASEND_PROXY_URL")?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const supabaseUrl =
    getServerEnv("SUPABASE_URL")?.trim() || getServerEnv("VITE_SUPABASE_URL")?.trim();
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/intasend-proxy`;
}

function proxySecret(): string | null {
  return (
    getServerEnv("INTASEND_PROXY_SECRET")?.trim() || getServerEnv("CRON_SECRET")?.trim() || null
  );
}

export type IntasendProxyResult = {
  ok: boolean;
  status: number;
  text: string;
};

/** Forward a request to IntaSend through the edge proxy. */
export async function intasendProxyFetch(opts: {
  path: string;
  method?: string;
  body?: unknown;
}): Promise<IntasendProxyResult> {
  const url = proxyUrl();
  const secret = proxySecret();
  if (!url || !secret) {
    return { ok: false, status: 0, text: "IntaSend proxy is not configured" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      path: opts.path,
      method: opts.method || "POST",
      body: opts.body,
    }),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

export function isIntasendIpBanResponse(status: number, raw: string): boolean {
  return status === 403 && /error code:\s*110[68]|access denied|ip (has been )?banned/i.test(raw);
}
