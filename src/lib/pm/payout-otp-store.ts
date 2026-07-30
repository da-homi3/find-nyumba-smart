import { getCacheKv } from "@/lib/kv/bindings";
import { generateSixDigitResetCode } from "@/lib/auth/password-reset-store";

const TTL_SECONDS = 15 * 60;
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

type PayoutOtpRecord = {
  code: string;
  userId: string;
  phone: string;
  expiresAt: number;
};

function keyFor(userId: string, phone: string): string {
  return `payout-otp:v1:${userId}:${phone.replaceAll(/\D/g, "")}`;
}

async function putJson(key: string, value: PayoutOtpRecord): Promise<void> {
  const payload = JSON.stringify(value);
  const kv = getCacheKv();
  if (kv) {
    await kv.put(key, payload, { expirationTtl: TTL_SECONDS });
    return;
  }
  memoryStore.set(key, {
    value: payload,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  });
}

async function getJson(key: string): Promise<PayoutOtpRecord | null> {
  const kv = getCacheKv();
  if (kv) {
    const raw = await kv.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PayoutOtpRecord;
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
    return JSON.parse(entry.value) as PayoutOtpRecord;
  } catch {
    return null;
  }
}

export async function storePayoutPhoneOtp(opts: {
  userId: string;
  phone: string;
}): Promise<string> {
  const code = generateSixDigitResetCode();
  await putJson(keyFor(opts.userId, opts.phone), {
    code,
    userId: opts.userId,
    phone: opts.phone,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  });
  return code;
}

export async function verifyPayoutPhoneOtp(opts: {
  userId: string;
  phone: string;
  code: string;
}): Promise<boolean> {
  const rec = await getJson(keyFor(opts.userId, opts.phone));
  if (!rec) return false;
  if (rec.userId !== opts.userId) return false;
  if (Date.now() > rec.expiresAt) return false;

  const expected = rec.code.trim();
  const provided = opts.code.trim();
  if (expected.length !== provided.length) return false;

  const enc = new TextEncoder();
  const a = enc.encode(expected);
  const b = enc.encode(provided);
  // timingSafeEqual requires equal-length buffers (checked above).
  if (typeof crypto !== "undefined" && "subtle" in crypto) {
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
    return diff === 0;
  }
  return expected === provided;
}
