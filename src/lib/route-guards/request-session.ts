import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function parseCookieHeader(header: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    map.set(key, value);
  }
  return map;
}

function decodeCookieValue(raw: string): unknown {
  const candidates = [raw, decodeURIComponent(raw)];
  for (const candidate of candidates) {
    try {
      const normalized = candidate.startsWith("base64-")
        ? candidate.slice("base64-".length)
        : candidate;
      const jsonText =
        normalized.startsWith("{") || normalized.startsWith("[")
          ? normalized
          : Buffer.from(normalized.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString(
              "utf8",
            );
      return JSON.parse(jsonText);
    } catch {
      /* try next */
    }
  }
  return null;
}

function accessTokenFromSessionPayload(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === "string" && payload.length > 20) return payload;
  if (Array.isArray(payload) && typeof payload[0] === "string") return payload[0];
  if (typeof payload === "object" && payload !== null && "access_token" in payload) {
    const token = (payload as { access_token?: unknown }).access_token;
    return typeof token === "string" ? token : null;
  }
  return null;
}

/** Extract Supabase access token from Authorization header or session cookies. */
export function extractRequestAccessToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = parseCookieHeader(cookieHeader);
  const authKeys = [...cookies.keys()].filter((key) => /^sb-[^=]+-auth-token(\.\d+)?$/i.test(key));
  if (!authKeys.length) return null;

  const grouped = new Map<string, string[]>();
  for (const key of authKeys) {
    const base = key.replace(/\.\d+$/, "");
    const chunk = key.includes(".") ? Number(key.split(".").pop()) : 0;
    const parts = grouped.get(base) ?? [];
    parts[chunk] = cookies.get(key) ?? "";
    grouped.set(base, parts);
  }

  for (const parts of grouped.values()) {
    const joined = parts.filter(Boolean).join("");
    const payload = decodeCookieValue(joined);
    const token = accessTokenFromSessionPayload(payload);
    if (token) return token;
  }

  return null;
}

export async function resolveRequestUserId(request: Request): Promise<string | null> {
  const token = extractRequestAccessToken(request);
  if (!token) return null;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}
