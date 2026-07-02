type ClientErrorPayload = {
  source: string;
  message: string;
  filters?: unknown;
  url?: string;
};

let lastReportAt = 0;

/** Fire-and-forget client error reporting (logged server-side). */
export function reportClientError(payload: ClientErrorPayload): void {
  if (globalThis.window === undefined) return;
  const now = Date.now();
  if (now - lastReportAt < 5000) return;
  lastReportAt = now;

  void fetch("/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      url: payload.url ?? globalThis.window.location.href,
      at: new Date().toISOString(),
    }),
  }).catch(() => undefined);
}
