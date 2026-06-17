export function unlockFeeForRent(rentKes: number): number {
  if (rentKes <= 20_000) return 50;
  if (rentKes <= 60_000) return 100;
  return 150;
}
