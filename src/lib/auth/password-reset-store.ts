import { getCacheKv } from "@/lib/kv/bindings";

const RESET_TTL_SECONDS = 15 * 60;
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

export type PasswordResetRecord = {
  /** Exactly 6 digits */
  code: string;
  userId: string;
  email: string;
  /** Set after successful OTP verification */
  verified: boolean;
  expiresAt: number;
};

function keyFor(email: string): string {
  return `pwreset:v1:${email.trim().toLowerCase()}`;
}

/** Cryptographically random 6-digit code (000000–999999). */
export function generateSixDigitResetCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

async function putJson(key: string, value: PasswordResetRecord): Promise<void> {
  const payload = JSON.stringify(value);
  const kv = getCacheKv();
  if (kv) {
    await kv.put(key, payload, { expirationTtl: RESET_TTL_SECONDS });
    return;
  }
  memoryStore.set(key, {
    value: payload,
    expiresAt: Date.now() + RESET_TTL_SECONDS * 1000,
  });
}

async function getJson(key: string): Promise<PasswordResetRecord | null> {
  const kv = getCacheKv();
  if (kv) {
    const raw = await kv.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PasswordResetRecord;
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
    return JSON.parse(entry.value) as PasswordResetRecord;
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

export async function storePasswordResetCode(opts: {
  email: string;
  userId: string;
  code: string;
}): Promise<void> {
  const email = opts.email.trim().toLowerCase();
  const code = opts.code.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Reset code must be exactly 6 digits");
  }
  await putJson(keyFor(email), {
    code,
    userId: opts.userId,
    email,
    verified: false,
    expiresAt: Date.now() + RESET_TTL_SECONDS * 1000,
  });
}

export async function readPasswordReset(email: string): Promise<PasswordResetRecord | null> {
  const record = await getJson(keyFor(email));
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    await deleteKey(keyFor(email));
    return null;
  }
  return record;
}

export async function markPasswordResetVerified(email: string): Promise<PasswordResetRecord> {
  const record = await readPasswordReset(email);
  if (!record) throw new Error("Reset code expired. Request a new code.");
  const next = { ...record, verified: true };
  await putJson(keyFor(email), next);
  return next;
}

export async function consumePasswordReset(email: string): Promise<void> {
  await deleteKey(keyFor(email));
}

export function codesMatch(expected: string, provided: string): boolean {
  const a = expected.trim();
  const b = provided.trim();
  if (a.length !== b.length || a.length !== 6) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
