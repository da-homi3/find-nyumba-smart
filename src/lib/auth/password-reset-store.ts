import { getCacheKv } from "@/lib/kv/bindings";

const RESET_TTL_SECONDS = 15 * 60;
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

/**
 * A 6-digit code has only a million possibilities, so unlimited guesses inside the 15
 * minute window is an account takeover. Burn the code after this many wrong attempts.
 */
export const MAX_RESET_CODE_ATTEMPTS = 5;

export type PasswordResetRecord = {
  /** Exactly 6 digits */
  code: string;
  userId: string;
  email: string;
  /** Set after successful OTP verification */
  verified: boolean;
  /** Wrong guesses so far; the code is invalidated at MAX_RESET_CODE_ATTEMPTS. */
  attempts: number;
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
    attempts: 0,
    expiresAt: Date.now() + RESET_TTL_SECONDS * 1000,
  });
}

/**
 * Reads the record and checks the supplied code, counting failures.
 *
 * Always go through this rather than comparing codes at the call site, so every guess is
 * counted and the code is destroyed once the attempt budget is spent.
 */
export async function consumeResetAttempt(
  email: string,
  code: string,
): Promise<{ ok: true; record: PasswordResetRecord } | { ok: false }> {
  const record = await readPasswordReset(email);
  if (!record) return { ok: false };

  if (codesMatch(record.code, code)) return { ok: true, record };

  const attempts = (record.attempts ?? 0) + 1;
  if (attempts >= MAX_RESET_CODE_ATTEMPTS) {
    await deleteKey(keyFor(email));
  } else {
    await putJson(keyFor(email), { ...record, attempts });
  }
  return { ok: false };
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
    mismatch |= (a.codePointAt(i) ?? 0) ^ (b.codePointAt(i) ?? 0);
  }
  return mismatch === 0;
}
