import { getServerEnv } from "@/lib/server-env";

export type ApiLayerProduct = "mailboxlayer" | "numverify" | "ipstack" | "streetlayer";

export type ProductAuth = { mode: "header" | "query"; key: string };

const REQUEST_TIMEOUT_MS = 4_000;

const PRODUCT_ENV_KEYS: Record<ApiLayerProduct, string[]> = {
  mailboxlayer: ["MAILBOXLAYER_ACCESS_KEY", "MAILBOXLAYER_API_KEY"],
  numverify: ["NUMVERIFY_ACCESS_KEY", "NUMVERIFY_API_KEY"],
  ipstack: ["IPSTACK_ACCESS_KEY", "IPSTACK_API_KEY"],
  streetlayer: ["STREETLAYER_ACCESS_KEY", "STREETLAYER_API_KEY"],
};

function firstEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getServerEnv(key)?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Shared APILayer marketplace key, or per-product classic access key. */
export function resolveProductAuth(product: ApiLayerProduct): ProductAuth | null {
  const shared =
    getServerEnv("APILAYER_API_KEY")?.trim() || getServerEnv("APILAYER_ACCESS_KEY")?.trim();
  if (shared) return { mode: "header", key: shared };

  const productKey = firstEnv(PRODUCT_ENV_KEYS[product]);
  if (productKey) return { mode: "query", key: productKey };
  return null;
}

export function isProductConfigured(product: ApiLayerProduct): boolean {
  return Boolean(resolveProductAuth(product));
}

export async function apilayerFetchJson(
  url: string,
  headers?: Record<string, string>,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, headers });
    if (!res.ok) {
      console.warn("[apilayer] HTTP", res.status, url.split("?")[0]);
      return null;
    }
    return (await res.json()) as unknown;
  } catch (err) {
    console.warn("[apilayer] request failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
