/** Deterministic UUID for seeded directory provider sp-XXX */
export function directoryProviderUuid(spNumber: number): string {
  const tail = String(spNumber).padStart(12, "0");
  const head = spNumber.toString(16).padStart(4, "0");
  return `c000${head}-0001-4000-8100-${tail}`;
}

export function providerWebsiteHref(sourceUrl: string | null | undefined): string | null {
  const raw = sourceUrl?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
}

/** Phone is clickable only when publicly verified (verified = 1) and present */
export function isProviderPhoneVerified(
  verified: number | boolean | null | undefined,
  phone: string | null | undefined,
): boolean {
  const ok = verified === 1 || verified === true;
  return ok && !!phone?.trim();
}
