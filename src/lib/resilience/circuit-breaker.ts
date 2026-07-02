import { getCacheKv } from "@/lib/kv/bindings";

type CircuitState = "closed" | "open" | "half-open";

const memoryCircuits = new Map<string, { state: CircuitState; failures: number }>();

async function readState(serviceName: string): Promise<{ state: CircuitState; failures: number }> {
  const kv = getCacheKv();
  const key = `circuit:${serviceName}`;
  if (kv) {
    const raw = await kv.get(key);
    if (raw) return JSON.parse(raw) as { state: CircuitState; failures: number };
    return { state: "closed", failures: 0 };
  }
  return memoryCircuits.get(key) ?? { state: "closed", failures: 0 };
}

async function writeState(
  serviceName: string,
  state: CircuitState,
  failures: number,
  ttl?: number,
): Promise<void> {
  const kv = getCacheKv();
  const key = `circuit:${serviceName}`;
  const payload = JSON.stringify({ state, failures });
  if (kv) {
    await kv.put(key, payload, { expirationTtl: ttl ?? 60 });
    return;
  }
  memoryCircuits.set(key, { state, failures });
}

export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  fallback?: () => T,
): Promise<T> {
  const current = await readState(serviceName);
  if (current.state === "open") {
    if (fallback) return fallback();
    throw new Error(`Circuit breaker OPEN for ${serviceName}`);
  }

  try {
    const result = await fn();
    if (current.state !== "closed") {
      await writeState(serviceName, "closed", 0);
    }
    return result;
  } catch (err) {
    const failures = current.failures + 1;
    if (failures >= 5) {
      await writeState(serviceName, "open", failures, 30);
      const { fireAlert } = await import("@/lib/alerts/fire-alert");
      fireAlert("critical", "scaling", `Circuit breaker OPENED for ${serviceName}`, {
        serviceName,
        failures,
      }).catch((e) => console.error("[circuit] alert failed:", e));
    } else {
      await writeState(serviceName, current.state, failures, 60);
    }
    if (fallback) return fallback();
    throw err;
  }
}
