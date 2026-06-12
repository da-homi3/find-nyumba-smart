/** Kenyan mobile: 07xxxxxxxx or +2547xxxxxxxx */
export function isValidKenyanPhone(raw: string): boolean {
  const digits = raw.replaceAll(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("07")) return true;
  if (digits.length === 12 && digits.startsWith("2547")) return true;
  return false;
}

export function formatKenyanPhone(raw: string): string {
  const digits = raw.replaceAll(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("254")) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return raw.trim();
}

export const formatKES = (amount: number) => `KES ${amount.toLocaleString("en-KE")}`;
