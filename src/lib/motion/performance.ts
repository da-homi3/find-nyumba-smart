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

export type HeroSceneBudget = {
  cars: number;
  peds: number;
  trees: number;
  tier: "off" | "medium" | "high";
};

/** Scene entity counts by device capability. */
export function getHeroSceneBudget(): HeroSceneBudget {
  if (!shouldUseHeavy3D()) {
    return { cars: 0, peds: 0, trees: 0, tier: "off" };
  }
  const nav = globalThis.navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  if (cores >= 8 && memory >= 4) {
    return { cars: 12, peds: 20, trees: 80, tier: "high" };
  }
  return { cars: 6, peds: 10, trees: 40, tier: "medium" };
}
