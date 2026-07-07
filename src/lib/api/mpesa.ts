import { getSiteUrl } from "@/lib/site";
import { getCacheKv } from "@/lib/kv/bindings";
import { withCircuitBreaker } from "@/lib/resilience/circuit-breaker";
import { getServerEnv, isServerEnvConfigured } from "@/lib/server-env";

type StkPushApiResponse = {
  CheckoutRequestID?: string;
  MerchantRequestID?: string;
  CustomerMessage?: string;
  errorMessage?: string;
};

type StkPushResult = {
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage: string;
};

function readOAuthToken(json: unknown): { token: string; expiresIn: number } {
  if (typeof json !== "object" || json === null) {
    throw new Error("M-Pesa OAuth missing access_token");
  }
  const token =
    "access_token" in json && typeof json.access_token === "string" ? json.access_token : "";
  const expiresIn =
    "expires_in" in json &&
    (typeof json.expires_in === "number" || typeof json.expires_in === "string")
      ? Number(json.expires_in)
      : 3600;
  if (!token) throw new Error("M-Pesa OAuth missing access_token");
  return { token, expiresIn };
}

function parseStkPushResponse(json: unknown): StkPushApiResponse {
  if (typeof json !== "object" || json === null) return {};
  const str = (key: string): string | undefined => {
    if (!(key in json)) return undefined;
    const value = json[key as keyof typeof json];
    return typeof value === "string" ? value : undefined;
  };
  return {
    CheckoutRequestID: str("CheckoutRequestID"),
    MerchantRequestID: str("MerchantRequestID"),
    CustomerMessage: str("CustomerMessage"),
    errorMessage: str("errorMessage"),
  };
}

function mpesaBaseUrl() {
  const env = getServerEnv("MPESA_ENV") ?? "sandbox";
  return env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

export function isMpesaConfigured(): boolean {
  return isServerEnvConfigured([
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE",
    "MPESA_PASSKEY",
  ]);
}

export function mpesaCallbackUrl(): string {
  if (getServerEnv("MPESA_CALLBACK_URL")) return getServerEnv("MPESA_CALLBACK_URL")!;
  return `${getSiteUrl()}/api/mpesa/callback`;
}

async function getAccessToken(): Promise<string> {
  const kv = getCacheKv();
  if (kv) {
    const cached = await kv.get("mpesa_token");
    if (cached) return cached;
  }

  const key = getServerEnv("MPESA_CONSUMER_KEY")!;
  const consumerSecret = getServerEnv("MPESA_CONSUMER_SECRET")!;
  const auth = Buffer.from(`${key}:${consumerSecret}`).toString("base64");

  const token = await withCircuitBreaker("mpesa", async () => {
    const res = await fetch(`${mpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      throw new Error(`M-Pesa OAuth failed: ${res.status}`);
    }
    const json: unknown = await res.json();
    const { token: accessToken, expiresIn } = readOAuthToken(json);
    if (kv) {
      await kv.put("mpesa_token", accessToken, {
        expirationTtl: Math.max(60, expiresIn - 60),
      });
    }
    return accessToken;
  });

  return token;
}

function buildStkCredentials(): { encodedCredential: string; timestamp: string } {
  const shortcode = getServerEnv("MPESA_SHORTCODE")!;
  const mpesaPasskey = getServerEnv("MPESA_PASSKEY")!;
  const timestamp = new Date().toISOString().replaceAll(/\D/g, "").slice(0, 14);
  const encodedCredential = Buffer.from(`${shortcode}${mpesaPasskey}${timestamp}`).toString(
    "base64",
  );
  return { encodedCredential, timestamp };
}

export async function initiateStkPush(opts: {
  phone254: string;
  amountKes: number;
  accountReference: string;
  transactionDesc: string;
}): Promise<StkPushResult> {
  if (opts.amountKes < 1) {
    throw new Error("Minimum STK push amount is KES 1");
  }
  if (opts.amountKes > 100_000) {
    throw new Error(
      `Amount KES ${opts.amountKes.toLocaleString()} exceeds STK Push limit. Use card payment for amounts over KES 100,000.`,
    );
  }
  const { assertStkPromptRateLimit } = await import("@/lib/payments/rate-limit");
  await assertStkPromptRateLimit({ phone254: opts.phone254 });
  const token = await getAccessToken();
  const { encodedCredential, timestamp } = buildStkCredentials();
  const shortcode = getServerEnv("MPESA_SHORTCODE")!;

  const res = await fetch(`${mpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: encodedCredential,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: opts.amountKes,
      PartyA: opts.phone254,
      PartyB: shortcode,
      PhoneNumber: opts.phone254,
      CallBackURL: mpesaCallbackUrl(),
      AccountReference: opts.accountReference.slice(0, 12),
      TransactionDesc: opts.transactionDesc.slice(0, 13),
    }),
  });

  const json = parseStkPushResponse(await res.json());

  if (!res.ok || !json.CheckoutRequestID) {
    throw new Error(json.errorMessage ?? json.CustomerMessage ?? "STK Push failed");
  }

  return {
    checkoutRequestId: json.CheckoutRequestID,
    merchantRequestId: json.MerchantRequestID ?? "",
    customerMessage: json.CustomerMessage ?? "Check your phone for the M-Pesa prompt.",
  };
}

export type StkQueryResult = {
  status: "success" | "pending" | "failed";
  resultDesc?: string;
  mpesaReceipt?: string;
};

function extractMpesaReceipt(json: object): string | undefined {
  if (!("CallbackMetadata" in json)) return undefined;
  const metadata = json.CallbackMetadata;
  if (typeof metadata !== "object" || metadata === null) return undefined;

  const items = "Item" in metadata && Array.isArray(metadata.Item) ? metadata.Item : [];
  for (const item of items) {
    if (
      item &&
      typeof item === "object" &&
      "Name" in item &&
      item.Name === "MpesaReceiptNumber" &&
      "Value" in item &&
      item.Value != null
    ) {
      return String(item.Value);
    }
  }
  return undefined;
}

function parseStkQueryResponse(json: unknown): StkQueryResult {
  if (typeof json !== "object" || json === null) return { status: "pending" };
  const resultCode = "ResultCode" in json ? String(json.ResultCode) : undefined;
  const resultDesc =
    "ResultDesc" in json && typeof json.ResultDesc === "string" ? json.ResultDesc : undefined;
  const mpesaReceipt = extractMpesaReceipt(json);

  if (resultCode === "0") {
    return { status: "success", resultDesc, mpesaReceipt };
  }
  // 1032 = cancelled by user, 1 = insufficient funds, etc.
  if (resultCode && resultCode !== "1037") {
    return { status: "failed", resultDesc };
  }
  return { status: "pending", resultDesc };
}

/** Check STK Push status with Daraja (fallback when callback is delayed). */
export async function queryStkPushStatus(checkoutRequestId: string): Promise<StkQueryResult> {
  const token = await getAccessToken();
  const { encodedCredential, timestamp } = buildStkCredentials();
  const shortcode = getServerEnv("MPESA_SHORTCODE")!;

  const res = await fetch(`${mpesaBaseUrl()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: encodedCredential,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  const json: unknown = await res.json();
  if (!res.ok) return { status: "pending" };
  return parseStkQueryResponse(json);
}

export type StkCallbackBody = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: {
        Item?: Array<{ Name?: string; Value?: string | number }>;
      };
    };
  };
};

export function parseStkCallback(body: StkCallbackBody) {
  const cb = body.Body?.stkCallback;
  if (!cb?.CheckoutRequestID) return null;
  const items = cb.CallbackMetadata?.Item ?? [];
  const meta: Record<string, string> = {};
  for (const item of items) {
    if (item.Name && item.Value != null) meta[item.Name] = String(item.Value);
  }
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    merchantRequestId: cb.MerchantRequestID ?? "",
    success: cb.ResultCode === 0,
    resultDesc: cb.ResultDesc ?? "",
    mpesaReceipt: meta.MpesaReceiptNumber ?? null,
    amount: meta.Amount ? Number(meta.Amount) : null,
  };
}
