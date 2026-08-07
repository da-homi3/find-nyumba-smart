import { getCacheKv } from "@/lib/kv/bindings";
import { toWhatsAppDigits } from "@/lib/phone";
import { timingSafeEqual } from "@/lib/security/timing-safe-equal";

const OTP_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_MS = 45_000;
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

export type PhoneSignupOtpRecord = {
  code: string;
  phone254: string;
  verified: boolean;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
};

function keyFor(phone254: string): string {
  return `phonesignup:v1:${phone254}`;
}

export function phoneSignupKvKey(phone: string): string | null {
  const digits = toWhatsAppDigits(phone);
  return digits ? keyFor(digits) : null;
}

/** Cryptographically random 6-digit code. */
export function generateSixDigitPhoneOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

async function putJson(key: string, value: PhoneSignupOtpRecord): Promise<void> {
  const payload = JSON.stringify(value);
  const kv = getCacheKv();
  if (kv) {
    await kv.put(key, payload, { expirationTtl: OTP_TTL_SECONDS });
    return;
  }
  memoryStore.set(key, {
    value: payload,
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
  });
}

async function getJson(key: string): Promise<PhoneSignupOtpRecord | null> {
  const kv = getCacheKv();
  if (kv) {
    const raw = await kv.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PhoneSignupOtpRecord;
    } catch {
      return null;
    }
  }
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  try {
    return JSON.parse(entry.value) as PhoneSignupOtpRecord;
  } catch {
    return null;
  }
}

async function deleteKey(key: string): Promise<void> {
  const kv = getCacheKv();
  if (kv) {
    await kv.delete(key);
    return;
  }
  memoryStore.delete(key);
}

export async function storePhoneSignupOtp(opts: {
  phone: string;
  code: string;
}): Promise<{ phone254: string; resentTooSoon?: boolean; retryAfterMs?: number }> {
  const phone254 = toWhatsAppDigits(opts.phone);
  if (!phone254) throw new Error("Invalid Kenyan mobile number");
  if (!/^\d{6}$/.test(opts.code.trim())) {
    throw new Error("OTP must be exactly 6 digits");
  }

  const key = keyFor(phone254);
  const existing = await getJson(key);
  if (existing && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    return {
      phone254,
      resentTooSoon: true,
      retryAfterMs: RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt),
    };
  }

  await putJson(key, {
    code: opts.code.trim(),
    phone254,
    verified: false,
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
    lastSentAt: Date.now(),
    attempts: 0,
  });
  return { phone254 };
}

export async function readPhoneSignupOtp(phone: string): Promise<PhoneSignupOtpRecord | null> {
  const phone254 = toWhatsAppDigits(phone);
  if (!phone254) return null;
  const record = await getJson(keyFor(phone254));
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    await deleteKey(keyFor(phone254));
    return null;
  }
  return record;
}

export async function markPhoneSignupOtpVerified(phone: string): Promise<PhoneSignupOtpRecord> {
  const phone254 = toWhatsAppDigits(phone);
  if (!phone254) throw new Error("Invalid Kenyan mobile number");
  const record = await readPhoneSignupOtp(phone254);
  if (!record) throw new Error("Code expired. Request a new code.");
  const next = { ...record, verified: true };
  await putJson(keyFor(phone254), next);
  return next;
}

export async function bumpPhoneSignupOtpAttempt(phone: string): Promise<void> {
  const record = await readPhoneSignupOtp(phone);
  if (!record) return;
  await putJson(keyFor(record.phone254), {
    ...record,
    attempts: record.attempts + 1,
  });
}

export async function requireVerifiedPhoneSignup(phone: string): Promise<string> {
  const record = await readPhoneSignupOtp(phone);
  if (!record?.verified) {
    throw new Error("Verify your phone with the SMS code before continuing.");
  }
  return record.phone254;
}

export async function consumePhoneSignupOtp(phone: string): Promise<void> {
  const phone254 = toWhatsAppDigits(phone);
  if (!phone254) return;
  await deleteKey(keyFor(phone254));
}

export function phoneOtpCodesMatch(expected: string, provided: string): boolean {
  const a = expected.trim();
  const b = provided.trim();
  if (a.length !== 6 || b.length !== 6) return false;
  return timingSafeEqual(a, b);
}
