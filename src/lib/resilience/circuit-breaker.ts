import { getCacheKv } from "@/lib/kv/bindings";

type CircuitState = "closed" | "open" | "half-open";

type CircuitRecord = {
  state: CircuitState;
  failures: number;
  openedAt?: number;
};

const memoryCircuits = new Map<string, CircuitRecord>();
const OPEN_COOLDOWN_MS = 15_000;
const FAILURE_THRESHOLD = 5;

async function readState(serviceName: string): Promise<CircuitRecord> {
  const kv = getCacheKv();
  const key = `circuit:${serviceName}`;
  if (kv) {
    try {
      const raw = await kv.get(key);
      if (raw) return JSON.parse(raw) as CircuitRecord;
    } catch (err) {
      console.error("[circuit] kv read failed", err);
    }
    return { state: "closed", failures: 0 };
  }
  return memoryCircuits.get(key) ?? { state: "closed", failures: 0 };
}

async function writeState(
  serviceName: string,
  state: CircuitState,
  failures: number,
  ttl?: number,
  openedAt?: number,
): Promise<void> {
  const kv = getCacheKv();
  const key = `circuit:${serviceName}`;
  const payload = JSON.stringify({
    state,
    failures,
    openedAt: openedAt ?? (state === "open" ? Date.now() : undefined),
  } satisfies CircuitRecord);
  if (kv) {
    try {
      await kv.put(key, payload, { expirationTtl: ttl ?? 60 });
      return;
    } catch (err) {
      console.error("[circuit] kv write failed", err);
    }
  }
  memoryCircuits.set(key, JSON.parse(payload) as CircuitRecord);
}

function isStillOpen(current: CircuitRecord): boolean {
  if (current.state !== "open") return false;
  const openedAt = current.openedAt ?? 0;
  return Boolean(openedAt) && Date.now() - openedAt < OPEN_COOLDOWN_MS;
}

async function recordFailure(serviceName: string, current: CircuitRecord): Promise<void> {
  const failures = current.failures + 1;
  if (failures >= FAILURE_THRESHOLD) {
    await writeState(serviceName, "open", failures, 30, Date.now());
    const { fireAlert } = await import("@/lib/alerts/fire-alert");
    fireAlert("critical", "scaling", `Circuit breaker OPENED for ${serviceName}`, {
      serviceName,
      failures,
    }).catch((e) => console.error("[circuit] alert failed:", e));
    return;
  }
  const nextState = current.state === "half-open" ? "half-open" : current.state;
  await writeState(serviceName, nextState, failures, 60);
}

export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  fallback?: () => T,
): Promise<T> {
  const current = await readState(serviceName);

  if (isStillOpen(current)) {
    if (fallback) return fallback();
    throw new Error(`Circuit breaker OPEN for ${serviceName}`);
  }

  if (current.state === "open") {
    await writeState(serviceName, "half-open", current.failures, 30, current.openedAt);
  }

  try {
    const result = await fn();
    if (current.state !== "closed") {
      await writeState(serviceName, "closed", 0);
    }
    return result;
  } catch (err) {
    await recordFailure(serviceName, current);
    if (fallback) return fallback();
    throw err;
  }
}
