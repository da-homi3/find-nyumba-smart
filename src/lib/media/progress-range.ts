/** Map a 0–100 stage percent into an overall [from, to] band. */
export function mapProgressRange(percent: number, from: number, to: number): number {
  const clamped = Math.max(0, Math.min(100, percent));
  return Math.round(from + (clamped / 100) * (to - from));
}

/** Never let the UI bar jump backwards (enhancement→upload felt like a restart). */
export function monotonicProgress(
  current: number | null | undefined,
  next: number | null,
): number | null {
  if (next == null) return next;
  if (current == null) return next;
  return Math.max(current, next);
}
