/** Per-listing contact unlock fee (KES) based on rent — range 50–500. */
export function unlockFeeForRent(rentKes: number): number {
  const rent = Number.isFinite(rentKes) ? Math.max(0, rentKes) : 0;
  if (rent <= 15_000) return 50;
  if (rent <= 25_000) return 100;
  if (rent <= 40_000) return 180;
  if (rent <= 60_000) return 280;
  if (rent <= 100_000) return 400;
  return 500;
}
