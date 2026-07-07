type EnvHolder = { __env__?: Record<string, unknown> };

/** Read Worker secrets/vars from process.env or Cloudflare binding bag. */
export function getServerEnv(key: string): string | undefined {
  if (typeof process !== "undefined") {
    const fromProcess = process.env[key];
    if (fromProcess) return fromProcess;
  }

  const env = (globalThis as EnvHolder).__env__;
  const fromBinding = env?.[key];
  return typeof fromBinding === "string" && fromBinding.length > 0 ? fromBinding : undefined;
}

export function isServerEnvConfigured(keys: string[]): boolean {
  return keys.every((key) => Boolean(getServerEnv(key)));
}
