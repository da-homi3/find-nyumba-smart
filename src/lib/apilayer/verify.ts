import { toWhatsAppDigits } from "@/lib/phone";
import { cacheGet, cacheSet } from "@/lib/cache/manager";
import {
  apilayerFetchJson,
  asBool,
  asNumber,
  asRecord,
  asString,
  isProductConfigured,
  resolveProductAuth,
} from "@/lib/apilayer/client";

const EMAIL_CACHE_TTL_SEC = 7 * 24 * 60 * 60;
const PHONE_CACHE_TTL_SEC = 30 * 24 * 60 * 60;

export function isApiLayerConfigured(product: "mailboxlayer" | "numverify"): boolean {
  return isProductConfigured(product);
}

export type MailboxlayerResult = {
  configured: boolean;
  /** Soft pass when API is down/unconfigured — never block signup on outage. */
  available: boolean;
  email: string;
  formatValid: boolean;
  mxFound: boolean | null;
  smtpCheck: boolean | null;
  disposable: boolean;
  free: boolean;
  role: boolean;
  score: number | null;
  didYouMean: string | null;
};

export type NumverifyResult = {
  configured: boolean;
  available: boolean;
  number: string;
  valid: boolean;
  countryCode: string | null;
  location: string | null;
  carrier: string | null;
  lineType: string | null;
  internationalFormat: string | null;
  localFormat: string | null;
};

async function checkEmailRaw(email: string): Promise<MailboxlayerResult> {
  const normalized = email.trim().toLowerCase();
  const auth = resolveProductAuth("mailboxlayer");
  const base: MailboxlayerResult = {
    configured: false,
    available: false,
    email: normalized,
    formatValid: true,
    mxFound: null,
    smtpCheck: null,
    disposable: false,
    free: false,
    role: false,
    score: null,
    didYouMean: null,
  };

  if (!auth) return base;

  const cacheKey = `apilayer:email:${normalized}`;
  const cached = await cacheGet<MailboxlayerResult>(cacheKey);
  if (cached?.available) return cached;

  let json: unknown = null;
  if (auth.mode === "header") {
    const paths = [
      `https://api.apilayer.com/email_verification/check?email=${encodeURIComponent(normalized)}`,
      `https://api.apilayer.com/mailboxlayer/check?email=${encodeURIComponent(normalized)}`,
    ];
    for (const url of paths) {
      json = await apilayerFetchJson(url, { apikey: auth.key });
      const row = asRecord(json);
      if (row && row.success !== false && (row.format_valid != null || row.email != null)) break;
      json = null;
    }
  } else {
    const url =
      `https://apilayer.net/api/check?access_key=${encodeURIComponent(auth.key)}` +
      `&email=${encodeURIComponent(normalized)}&smtp=1&format=1`;
    json = await apilayerFetchJson(url);
  }

  const row = asRecord(json);
  if (!row || row.success === false) {
    console.warn("[mailboxlayer] unavailable or error", row?.error ?? null);
    return { ...base, configured: true, available: false };
  }

  const result: MailboxlayerResult = {
    configured: true,
    available: true,
    email: asString(row.email) ?? normalized,
    formatValid: asBool(row.format_valid) ?? true,
    mxFound: asBool(row.mx_found),
    smtpCheck: asBool(row.smtp_check),
    disposable: asBool(row.disposable) ?? false,
    free: asBool(row.free) ?? false,
    role: asBool(row.role) ?? false,
    score: asNumber(row.score),
    didYouMean: asString(row.did_you_mean),
  };

  await cacheSet(cacheKey, result, { kvTtl: EMAIL_CACHE_TTL_SEC });
  return result;
}

async function checkPhoneRaw(phone: string): Promise<NumverifyResult> {
  const digits = toWhatsAppDigits(phone) ?? phone.replaceAll(/\D/g, "");
  const auth = resolveProductAuth("numverify");
  const base: NumverifyResult = {
    configured: false,
    available: false,
    number: digits,
    valid: true,
    countryCode: null,
    location: null,
    carrier: null,
    lineType: null,
    internationalFormat: null,
    localFormat: null,
  };

  if (!auth) return base;

  const cacheKey = `apilayer:phone:${digits}`;
  const cached = await cacheGet<NumverifyResult>(cacheKey);
  if (cached?.available) return cached;

  let json: unknown = null;
  if (auth.mode === "header") {
    const url =
      `https://api.apilayer.com/number_verification/validate?number=${encodeURIComponent(digits)}` +
      `&country_code=KE`;
    json = await apilayerFetchJson(url, { apikey: auth.key });
  } else {
    const url =
      `https://apilayer.net/api/validate?access_key=${encodeURIComponent(auth.key)}` +
      `&number=${encodeURIComponent(digits)}&country_code=KE&format=1`;
    json = await apilayerFetchJson(url);
  }

  const row = asRecord(json);
  if (!row || row.success === false) {
    console.warn("[numverify] unavailable or error", row?.error ?? null);
    return { ...base, configured: true, available: false };
  }

  const result: NumverifyResult = {
    configured: true,
    available: true,
    number: digits,
    valid: asBool(row.valid) ?? false,
    countryCode: asString(row.country_code),
    location: asString(row.location),
    carrier: asString(row.carrier),
    lineType: asString(row.line_type),
    internationalFormat: asString(row.international_format),
    localFormat: asString(row.local_format),
  };

  await cacheSet(cacheKey, result, { kvTtl: PHONE_CACHE_TTL_SEC });
  return result;
}

/** Signup / unlock email policy — disposable & broken mailboxes blocked; Gmail allowed. */
export function evaluateMailboxlayer(result: MailboxlayerResult): {
  ok: boolean;
  reason?: string;
} {
  if (!result.configured || !result.available) return { ok: true };
  if (!result.formatValid) {
    const hint = result.didYouMean ? ` Did you mean ${result.didYouMean}?` : "";
    return { ok: false, reason: `Enter a valid email address.${hint}` };
  }
  if (result.disposable) {
    return { ok: false, reason: "Disposable email addresses are not allowed. Use your real email." };
  }
  if (result.mxFound === false) {
    const hint = result.didYouMean ? ` Did you mean ${result.didYouMean}?` : "";
    return { ok: false, reason: `That email domain cannot receive mail.${hint}` };
  }
  if (result.score != null && result.score < 0.2) {
    return { ok: false, reason: "That email looks unreliable. Use a different address." };
  }
  if (result.didYouMean && result.smtpCheck === false) {
    return {
      ok: false,
      reason: `That email looks mistyped. Did you mean ${result.didYouMean}?`,
    };
  }
  return { ok: true };
}

/** Kenyan mobile policy for signup + M-Pesa unlock. */
export function evaluateNumverify(result: NumverifyResult): {
  ok: boolean;
  reason?: string;
} {
  if (!result.configured || !result.available) return { ok: true };
  if (!result.valid) {
    return { ok: false, reason: "Enter a valid Kenyan mobile number (07XX XXX XXX)." };
  }
  if (result.countryCode && result.countryCode.toUpperCase() !== "KE") {
    return { ok: false, reason: "Use a Kenyan mobile number (+254)." };
  }
  const line = (result.lineType ?? "").toLowerCase();
  if (line && line !== "mobile" && !line.includes("mobile")) {
    return { ok: false, reason: "Use a Kenyan mobile number (not landline)." };
  }
  return { ok: true };
}

export async function assertCleanEmail(
  email: string,
  context: "signup" | "unlock",
): Promise<MailboxlayerResult> {
  const result = await checkEmailRaw(email);
  const decision = evaluateMailboxlayer(result);
  if (!decision.ok) {
    throw new Error(decision.reason ?? "Invalid email address.");
  }
  if (result.configured && result.available) {
    console.info(`[apilayer] mailboxlayer ok (${context})`, {
      disposable: result.disposable,
      free: result.free,
      score: result.score,
    });
  }
  return result;
}

export async function assertCleanKenyanMobile(
  phone: string,
  context: "signup" | "unlock",
): Promise<NumverifyResult> {
  const result = await checkPhoneRaw(phone);
  const decision = evaluateNumverify(result);
  if (!decision.ok) {
    throw new Error(decision.reason ?? "Invalid phone number.");
  }
  if (result.configured && result.available) {
    console.info(`[apilayer] numverify ok (${context})`, {
      country: result.countryCode,
      lineType: result.lineType,
      carrier: result.carrier,
    });
  }
  return result;
}

/**
 * Prefer numbers Numverify confirms as valid Kenyan mobiles.
 * On API outage, keep the original list (fail open).
 */
export async function filterTrustedContactPhones(phones: string[]): Promise<string[]> {
  if (phones.length === 0) return phones;
  if (!isApiLayerConfigured("numverify")) return phones;

  const checks = await Promise.all(
    phones.map(async (phone) => ({ phone, result: await checkPhoneRaw(phone) })),
  );
  const anyAvailable = checks.some((c) => c.result.available);
  if (!anyAvailable) return phones;

  const trusted = checks.filter((c) => evaluateNumverify(c.result).ok).map((c) => c.phone);
  return trusted.length > 0 ? trusted : phones;
}
