import { getSiteUrl } from "@/lib/site";

function secret(): string {
  return (
    process.env.EMAIL_UNSUBSCRIBE_SECRET ??
    process.env.CARETAKER_SESSION_SECRET ??
    process.env.CRON_SECRET ??
    "nyumba-email-unsub"
  );
}

function b64url(data: string): string {
  return btoa(data).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromB64url(data: string): string {
  const pad = data.length % 4 === 0 ? "" : "=".repeat(4 - (data.length % 4));
  return atob(data.replaceAll("-", "+").replaceAll("_", "/") + pad);
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const bytes = Array.from(new Uint8Array(sig), (b) => String.fromCodePoint(b)).join("");
  return b64url(bytes);
}

/** Create signed unsubscribe token for marketing emails. */
export async function createUnsubscribeToken(userId: string): Promise<string> {
  const payload = b64url(JSON.stringify({ u: userId, exp: Date.now() + 90 * 24 * 60 * 60 * 1000 }));
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifyUnsubscribeToken(token: string): Promise<string | null> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await sign(payload);
  if (sig !== expected) return null;
  try {
    const parsed = JSON.parse(fromB64url(payload)) as { u: string; exp: number };
    if (!parsed.u || parsed.exp < Date.now()) return null;
    return parsed.u;
  } catch {
    return null;
  }
}

export async function unsubscribeUrl(userId: string): Promise<string> {
  const token = await createUnsubscribeToken(userId);
  return `${getSiteUrl()}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
}
