/** Cloudflare KV binding — optional; falls back to in-memory when unbound (local dev). */
export type KvNamespace = {
  get: (key: string, type?: "text") => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number; metadata?: unknown },
  ) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

type EnvHolder = { __env__?: Record<string, unknown> };

export function getCacheKv(): KvNamespace | undefined {
  const env = (globalThis as EnvHolder).__env__;
  const kv = env?.CACHE_KV;
  if (!kv || typeof kv !== "object") return undefined;
  const binding = kv as KvNamespace;
  if (typeof binding.get !== "function" || typeof binding.put !== "function") return undefined;
  return binding;
}
