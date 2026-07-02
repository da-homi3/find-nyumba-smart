export async function verifyWebhookSignature(
  rawBody: string,
  sigHeader: string,
  appSecret: string,
): Promise<boolean> {
  if (!sigHeader.startsWith("sha256=")) return false;
  const receivedSig = sigHeader.slice(7);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computedSig = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedSig.length !== receivedSig.length) return false;
  let diff = 0;
  for (let i = 0; i < computedSig.length; i++) {
    const a = computedSig.codePointAt(i) ?? 0;
    const b = receivedSig.codePointAt(i) ?? 0;
    diff |= a ^ b;
  }
  return diff === 0;}
