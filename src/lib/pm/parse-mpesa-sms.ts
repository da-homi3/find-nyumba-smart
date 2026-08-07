/**
 * Parse common Safaricom M-Pesa confirmation SMS / forwarded texts.
 * Returns null when the message is not recognizable as a payment confirmation.
 */

export type ParsedMpesaSms = {
  receipt: string;
  amountKes: number;
  paidAt: Date | null;
  phone: string | null;
  raw: string;
};

const RECEIPT_RE = /\b([A-Z0-9]{10})\b/;
const AMOUNT_RE = /(?:Ksh\.?|KES)\s*([\d,]+(?:\.\d{1,2})?)/i;
const PHONE_RE = /\b(2547\d{8}|07\d{8}|\+2547\d{8})\b/;
const DATE_RE =
  /(?:on\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:at\s+)?(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i;
const AMPM_TIME_RE = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/;
const H24_TIME_RE = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;

function parseKenyanAmount(raw: string): number | null {
  const cleaned = raw.replaceAll(",", "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function parsePaidAt(datePart: string, timePart: string): Date | null {
  try {
    const [d, m, yRaw] = datePart.split("/").map(Number);
    if (!d || !m || !yRaw) return null;
    const year = yRaw < 100 ? 2000 + yRaw : yRaw;
    const time = timePart.trim().toUpperCase();
    const ampm = time.includes("AM") || time.includes("PM");
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    if (ampm) {
      const match = AMPM_TIME_RE.exec(time);
      if (!match) return null;
      hours = Number(match[1]);
      minutes = Number(match[2]);
      seconds = Number(match[3] ?? 0);
      const mer = match[4];
      if (mer === "PM" && hours < 12) hours += 12;
      if (mer === "AM" && hours === 12) hours = 0;
    } else {
      const match = H24_TIME_RE.exec(time);
      if (!match) return null;
      hours = Number(match[1]);
      minutes = Number(match[2]);
      seconds = Number(match[3] ?? 0);
    }
    return new Date(year, m - 1, d, hours, minutes, seconds);
  } catch {
    return null;
  }
}

/** Normalize phone to 2547XXXXXXXX when possible. */
export function normalizeKenyanMpesaPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replaceAll(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("7")) return `254${digits}`;
  return digits || null;
}

/**
 * Extract receipt, amount, optional date/phone from an M-Pesa confirmation message.
 */
export function parseMpesaSms(rawInput: string): ParsedMpesaSms | null {
  const raw = rawInput.replaceAll(/\s+/g, " ").trim();
  if (raw.length < 20) return null;

  const lower = raw.toLowerCase();
  const looksLikeMpesa =
    lower.includes("confirmed") ||
    lower.includes("mpesa") ||
    lower.includes("m-pesa") ||
    lower.includes("sent to") ||
    lower.includes("received from") ||
    AMOUNT_RE.test(raw);
  if (!looksLikeMpesa) return null;

  const receiptMatch = RECEIPT_RE.exec(raw);
  const amountMatch = AMOUNT_RE.exec(raw);
  if (!receiptMatch || !amountMatch) return null;

  const amountKes = parseKenyanAmount(amountMatch[1]);
  if (amountKes == null) return null;

  const receipt = receiptMatch[1].toUpperCase();
  // Receipt codes are typically alphanumeric; reject pure-digit false positives under 10 chars already handled
  if (!/[A-Z]/.test(receipt)) return null;

  const phoneMatch = PHONE_RE.exec(raw);
  const dateMatch = DATE_RE.exec(raw);
  const paidAt = dateMatch != null ? parsePaidAt(dateMatch[1], dateMatch[2]) : null;

  return {
    receipt,
    amountKes,
    paidAt,
    phone: normalizeKenyanMpesaPhone(phoneMatch?.[1] ?? null),
    raw: rawInput.trim(),
  };
}
