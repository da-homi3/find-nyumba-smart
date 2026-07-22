/** Kenyan mobile: 07XXXXXXXX, 01XXXXXXXX, or +2547/1XXXXXXXX */
export const KENYAN_MOBILE = /^(?:\+?254|0)?[17]\d{8}$/;

export function isKenyanPhone(value: string): boolean {
  const normalized = value.replaceAll(/[\s\-()]/g, "");
  return KENYAN_MOBILE.test(normalized);
}

export function formatKenyanPhoneHint(): string {
  return "07XX XXX XXX or +254 7XX XXX XXX";
}

/** Digits-only 2547XXXXXXXX for M-Pesa STK / Daraja. */
export function toMpesaPhone254(phone: string): string | null {
  return toWhatsAppDigits(phone);
}

/** Canonical local form for storage: 07XXXXXXXX (no spaces). */
export function normalizeKenyanPhoneLocal(phone: string): string | null {
  const digits = toWhatsAppDigits(phone);
  if (!digits) return null;
  return `0${digits.slice(3)}`;
}

/** Pretty local format: 0712 345 678 */
export function formatKenyanPhoneDisplay(value: string): string {
  const digits = toWhatsAppDigits(value);
  if (!digits) return value.trim();
  const local = `0${digits.slice(3)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** First valid Kenyan phone from profile / auth metadata. */
export function resolveAccountPhone(
  user: { phone?: string | null; user_metadata?: Record<string, unknown> } | null | undefined,
  profilePhone?: string | null,
): string {
  const candidates = [
    profilePhone,
    typeof user?.user_metadata?.phone === "string" ? user.user_metadata.phone : null,
    user?.phone,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && isKenyanPhone(candidate)) {
      return normalizeKenyanPhoneLocal(candidate) ?? candidate.trim();
    }
  }
  return "";
}

/** E.164 digits only (2547XXXXXXXX) for wa.me links */
export function toWhatsAppDigits(phone: string): string | null {
  const clean = phone.replaceAll(/[\s\-()]/g, "").replace(/^\+/, "");
  if (/^254[17]\d{8}$/.test(clean)) return clean;
  if (/^0[17]\d{8}$/.test(clean)) return `254${clean.slice(1)}`;
  if (/^[17]\d{8}$/.test(clean)) return `254${clean}`;
  return null;
}

export function whatsAppUrl(phone: string, message?: string): string | null {
  const digits = toWhatsAppDigits(phone);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}
