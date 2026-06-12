/** Kenyan mobile: 07XXXXXXXX, 01XXXXXXXX, or +2547/1XXXXXXXX */
export const KENYAN_MOBILE = /^(?:\+?254|0)?[17]\d{8}$/;

export function isKenyanPhone(value: string): boolean {
  const normalized = value.replace(/[\s-]/g, "");
  return KENYAN_MOBILE.test(normalized);
}

export function formatKenyanPhoneHint(): string {
  return "07XX XXX XXX or +254 7XX XXX XXX";
}
