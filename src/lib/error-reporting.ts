/** Client-side error reporting (console; wire to observability later if needed). */
export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof globalThis.document === "undefined") return;
  console.error("[NyumbaSearch]", error, {
    route: globalThis.location.pathname,
    ...context,
  });
}
