/** Device / motion capability helpers for 3D and animation budgets. */

function isBrowser(): boolean {
  return globalThis.window !== undefined && globalThis.document !== undefined;
}

function matchesMedia(query: string): boolean {
  if (!isBrowser() || typeof globalThis.matchMedia !== "function") return false;
  return globalThis.matchMedia(query).matches;
}

export function isTouchDevice(): boolean {
  if (!isBrowser()) return false;
  return "ontouchstart" in globalThis.window || (globalThis.navigator?.maxTouchPoints ?? 0) > 0;
}

export function isMobileViewport(): boolean {
  return matchesMedia("(max-width: 768px)");
}

export function prefersReducedMotion(): boolean {
  return matchesMedia("(prefers-reduced-motion: reduce)");
}

export function isLowEndDevice(): boolean {
  if (!isBrowser()) return false;

  const nav = globalThis.navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency;
  const memory = nav.deviceMemory;

  if (cores != null && cores <= 4) return true;
  if (memory != null && memory <= 2) return true;
  return false;
}

/** Desktop-only, capable devices with motion allowed. Always false during SSR. */
export function shouldUseHeavy3D(): boolean {
  if (!isBrowser()) return false;
  return !isLowEndDevice() && !prefersReducedMotion() && !isMobileViewport();
}

export function targetFps(): number {
  return isLowEndDevice() ? 30 : 60;
}
