/** Client-side error reporting — console + rate-limited POST to Worker logs. */
import { reportClientError as postClientError } from "@/lib/client-error-report";

export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof globalThis.document === "undefined") return;
  const route = globalThis.location.pathname;
  console.error("[NyumbaSearch]", error, {
    route,
    ...context,
  });
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "Unknown client error";
  postClientError({
    source: String(context.source ?? "error-boundary"),
    message: message.slice(0, 500),
    filters: context,
    url: globalThis.location.href,
  });
}

let globalHandlersInstalled = false;

/** Forward unhandled window errors to /api/client-errors (once per boot). */
export function installGlobalClientErrorReporting() {
  if (typeof globalThis.window === "undefined" || globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  globalThis.window.addEventListener("error", (event) => {
    reportClientError(event.error ?? event.message, { source: "window.error" });
  });
  globalThis.window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, { source: "window.unhandledrejection" });
  });
}
