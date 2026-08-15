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

export function contactAccessLabel(feeKes: number): string {
  return feeKes >= 300 ? "Premium property contact" : "Contact access";
}

export function unlockFeeExplanation(): string {
  return "Contact access is a one-time fee based on listing rent: KES 50 (up to 15k), 100 (to 25k), 180 (to 40k), 280 (to 60k), 400 (to 100k), 500 above that.";
}
