/**
 * RFC4122 UUID v4 for browsers that lack crypto.randomUUID (e.g. older iOS Safari).
 * Prefers native crypto.randomUUID, then getRandomValues, then a weak Math.random fallback.
 */

function uuidFromGetRandomValues(getRandomValues: (array: Uint8Array) => Uint8Array): string {
  const bytes = new Uint8Array(16);
  getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function uuidFromMathRandom(): string {
  // Last resort — not cryptographically strong; only for legacy environments.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const n = (Math.random() * 16) | 0;
    const v = ch === "x" ? n : (n & 0x3) | 0x8;
    return v.toString(16);
  });
}

function uuidFallback(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.getRandomValues === "function") {
    return uuidFromGetRandomValues((buf) => c.getRandomValues(buf));
  }
  return uuidFromMathRandom();
}

/** Bound native implementation, captured before any polyfill. */
let nativeRandomUUID: (() => string) | null | undefined;
let installedPolyfill = false;

function captureNativeRandomUUID(): (() => string) | null {
  if (nativeRandomUUID !== undefined) return nativeRandomUUID;
  if (installedPolyfill) {
    nativeRandomUUID = null;
    return null;
  }
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") {
    nativeRandomUUID = c.randomUUID.bind(c);
    return nativeRandomUUID;
  }
  nativeRandomUUID = null;
  return null;
}

export function randomUuid(): string {
  const native = captureNativeRandomUUID();
  if (native) return native();
  return uuidFallback();
}

/** Patch crypto.randomUUID when missing so third-party / existing call sites keep working. */
export function ensureCryptoRandomUUID(): void {
  const c = globalThis.crypto as Crypto | undefined;
  if (!c) return;

  if (typeof c.randomUUID === "function") {
    captureNativeRandomUUID();
    return;
  }

  // Capture "no native" before installing so randomUuid never recurses through the polyfill.
  nativeRandomUUID = null;
  installedPolyfill = true;

  const polyfill = () => uuidFallback();

  try {
    Object.defineProperty(c, "randomUUID", {
      configurable: true,
      writable: true,
      value: polyfill,
    });
  } catch {
    try {
      // @ts-expect-error — assigning when defineProperty is blocked
      c.randomUUID = polyfill;
    } catch {
      // Callers should use randomUuid() directly.
    }
  }
}

ensureCryptoRandomUUID();
