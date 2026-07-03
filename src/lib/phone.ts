/** Kenyan mobile: 07XXXXXXXX, 01XXXXXXXX, or +2547/1XXXXXXXX */
export const KENYAN_MOBILE = /^(?:\+?254|0)?[17]\d{8}$/;

export function isKenyanPhone(value: string): boolean {
  const normalized = value.replaceAll(/[\s-]/g, "");
  return KENYAN_MOBILE.test(normalized);
}

export function formatKenyanPhoneHint(): string {
  return "07XX XXX XXX or +254 7XX XXX XXX";
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
