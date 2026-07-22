/** Per-listing contact unlock fee (KES) based on rent — range 30–150. */
export function unlockFeeForRent(rentKes: number): number {
  const rent = Number.isFinite(rentKes) ? Math.max(0, rentKes) : 0;
  if (rent <= 15_000) return 30;
  if (rent <= 25_000) return 50;
  if (rent <= 40_000) return 80;
  if (rent <= 60_000) return 100;
  if (rent <= 100_000) return 120;
  return 150;
}
