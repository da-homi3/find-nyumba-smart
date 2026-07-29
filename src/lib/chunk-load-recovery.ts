/** Detect Vite/webpack "Failed to fetch dynamically imported module" after deploys. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error);
  const name = error instanceof Error ? error.name : "";
  return (
    name === "ChunkLoadError" ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Unable to preload CSS/i.test(message) ||
    /Unable to preload module/i.test(message)
  );
}

const RELOAD_KEY = "nyumba_chunk_reload";

/**
 * One-shot hard reload when a stale asset hash 404s after deploy.
 * Avoids infinite reload loops with sessionStorage.
 */
export function reloadOnceForStaleChunk(): boolean {
  if (globalThis.sessionStorage === undefined) {
    globalThis.location.reload();
    return true;
  }
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === "1") {
      sessionStorage.removeItem(RELOAD_KEY);
      return false;
    }
    sessionStorage.setItem(RELOAD_KEY, "1");
    globalThis.location.reload();
    return true;
  } catch {
    globalThis.location.reload();
    return true;
  }
}

/** Clear the reload guard after a successful page load. */
export function clearChunkReloadGuard(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* ignore */
  }
}

let preloadListenerInstalled = false;

/**
 * Vite fires `vite:preloadError` when a CSS/JS chunk preload fails after a deploy.
 * Recover with a one-shot reload instead of leaving users on a dead error screen.
 */
export function installVitePreloadRecovery(): void {
  if (preloadListenerInstalled || typeof globalThis.window === "undefined") return;
  preloadListenerInstalled = true;
  globalThis.window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadOnceForStaleChunk();
  });
}
