/** Device capability helpers for motion and interaction budgets. */

function isBrowser(): boolean {
  return globalThis.window !== undefined && globalThis.document !== undefined;
}

export function isTouchDevice(): boolean {
  if (!isBrowser()) return false;
  return "ontouchstart" in globalThis.window || (globalThis.navigator?.maxTouchPoints ?? 0) > 0;
}
