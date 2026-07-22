import { getSiteUrl } from "@/lib/site";
import { getServerEnv } from "@/lib/server-env";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

export function isPesapalConfigured(): boolean {
  return Boolean(
    getServerEnv("PESAPAL_CONSUMER_KEY")?.trim() &&
      getServerEnv("PESAPAL_CONSUMER_SECRET")?.trim() &&
      getServerEnv("PESAPAL_NOTIFICATION_ID")?.trim(),
  );
}

function apiBase(): string {
  return getServerEnv("PESAPAL_ENV") === "live"
    ? "https://pay.pesapal.com/v3/api"
    : "https://cybqa.pesapal.com/pesapalv3/api";
}

export function pesapalCallbackUrl(): string {
  const configured = getServerEnv("PESAPAL_CALLBACK_URL");
  if (configured) return configured;
  return `${getSiteUrl()}/api/payments/callback/card`;
}

function consumerKey(): string {
  const key = getServerEnv("PESAPAL_CONSUMER_KEY");
  if (!key) throw new Error("Pesapal is not configured");
  return key;
}

function consumerSecret(): string {
  const secret = getServerEnv("PESAPAL_CONSUMER_SECRET");
  if (!secret) throw new Error("Pesapal is not configured");
  return secret;
}

function readString(obj: unknown, key: string): string | undefined {
  if (typeof obj !== "object" || obj === null || !(key in obj)) return undefined;
  const value = obj[key as keyof typeof obj];
  return typeof value === "string" ? value : undefined;
}

function readNumber(obj: unknown, key: string): number | undefined {
  if (typeof obj !== "object" || obj === null || !(key in obj)) return undefined;
  const value = obj[key as keyof typeof obj];
  return typeof value === "number" ? value : undefined;
}

function readNestedMessage(obj: unknown): string | undefined {
  if (typeof obj !== "object" || obj === null || !("error" in obj)) return undefined;
  const error = obj.error;
  if (typeof error !== "object" || error === null || !("message" in error)) return undefined;
  return typeof error.message === "string" ? error.message : undefined;
}

function parseAuthTokenResponse(json: unknown): {
  token?: string;
  expiryDate?: string;
  message?: string;
  errorMessage?: string;
} {
  return {
    token: readString(json, "token"),
    expiryDate: readString(json, "expiryDate"),
    message: readString(json, "message"),
    errorMessage: readNestedMessage(json),
  };
}

function parseSubmitOrderResponse(json: unknown): {
  redirect_url?: string;
  order_tracking_id?: string;
  merchant_reference?: string;
  message?: string;
  errorMessage?: string;
} {
  return {
    redirect_url: readString(json, "redirect_url"),
    order_tracking_id: readString(json, "order_tracking_id"),
    merchant_reference: readString(json, "merchant_reference"),
    message: readString(json, "message"),
    errorMessage: readNestedMessage(json),
  };
}

function parseTransactionStatusResponse(json: unknown): {
  amount?: number;
  merchant_reference?: string;
  payment_status_description?: string;
  status_code?: number;
  confirmation_code?: string;
} {
  return {
    amount: readNumber(json, "amount"),
    merchant_reference: readString(json, "merchant_reference"),
    payment_status_description: readString(json, "payment_status_description"),
    status_code: readNumber(json, "status_code"),
    confirmation_code: readString(json, "confirmation_code"),
  };
}

function parseRegisterIpnResponse(json: unknown): {
  ipn_id?: string;
  message?: string;
  errorMessage?: string;
} {
  return {
    ipn_id: readString(json, "ipn_id"),
    message: readString(json, "message"),
    errorMessage: readNestedMessage(json),
  };
}

function notificationId(): string {
  const id = getServerEnv("PESAPAL_NOTIFICATION_ID");
  if (!id)
    throw new Error("PESAPAL_NOTIFICATION_ID is required — register your IPN URL with Pesapal");
  return id;
}

async function getAuthToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 15_000) {
    return tokenCache.token;
  }

  const res = await fetch(`${apiBase()}/Auth/RequestToken`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      consumer_key: consumerKey(),
      consumer_secret: consumerSecret(),
    }),
  });

  const data = parseAuthTokenResponse(await res.json());

  if (!data.token) {
    throw new Error(data.errorMessage ?? data.message ?? "Pesapal authentication failed");
  }

  const expiresAt = data.expiryDate ? new Date(data.expiryDate).getTime() : now + 4 * 60_000;

  tokenCache = { token: data.token, expiresAt };
  return data.token;
}

/** Lightweight auth check for health / ops — does not create a payment. */
export async function probePesapalAuth(): Promise<boolean> {
  if (!isPesapalConfigured()) return false;
  const token = await getAuthToken();
  return Boolean(token);
}

export type PesapalInitResult = {
  authorizationUrl: string;
  reference: string;
  orderTrackingId: string;
};

export async function initiateCardPayment(opts: {
  reference: string;
  amountKes: number;
  email: string;
  name?: string;
  phone?: string;
  description?: string;
}): Promise<PesapalInitResult> {
  const token = await getAuthToken();
  const [firstName, ...rest] = (opts.name ?? "NyumbaSearch Customer").split(" ");
  const lastName = rest.join(" ") || "Customer";

  const res = await fetch(`${apiBase()}/Transactions/SubmitOrderRequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: opts.reference,
      currency: "KES",
      amount: opts.amountKes,
      description: opts.description ?? "NyumbaSearch payment",
      callback_url: pesapalCallbackUrl(),
      notification_id: notificationId(),
      billing_address: {
        email_address: opts.email,
        phone_number: opts.phone ?? "",
        first_name: firstName,
        last_name: lastName,
      },
    }),
  });

  const data = parseSubmitOrderResponse(await res.json());

  if (!data.redirect_url || !data.order_tracking_id) {
    throw new Error(data.errorMessage ?? data.message ?? "Pesapal order submission failed");
  }

  return {
    authorizationUrl: data.redirect_url,
    reference: data.merchant_reference ?? opts.reference,
    orderTrackingId: data.order_tracking_id,
  };
}

export type PesapalVerifyResult = {
  status: "success" | "failed" | "pending";
  amountKes: number;
  merchantReference: string;
  orderTrackingId: string;
  confirmationCode?: string;
};

export async function getTransactionStatus(orderTrackingId: string): Promise<PesapalVerifyResult> {
  const token = await getAuthToken();
  const res = await fetch(
    `${apiBase()}/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
  );

  const data = parseTransactionStatusResponse(await res.json());

  const merchantReference = data.merchant_reference ?? "";
  const amountKes = Math.round(Number(data.amount ?? 0));
  const statusCode = data.status_code;
  const desc = (data.payment_status_description ?? "").toUpperCase();

  let status: PesapalVerifyResult["status"] = "pending";
  if (statusCode === 1 || desc === "COMPLETED") status = "success";
  else if (statusCode === 2 || statusCode === 0 || desc === "FAILED" || desc === "INVALID") {
    status = "failed";
  }

  return {
    status,
    amountKes,
    merchantReference,
    orderTrackingId,
    confirmationCode: data.confirmation_code,
  };
}

/** Register IPN URL (one-time setup). Returns ipn_id for PESAPAL_NOTIFICATION_ID. */
export async function registerIpnUrl(ipnUrl: string): Promise<string> {
  const token = await getAuthToken();
  const res = await fetch(`${apiBase()}/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: ipnUrl,
      ipn_notification_type: "POST",
    }),
  });

  const data = parseRegisterIpnResponse(await res.json());

  if (!data.ipn_id) {
    throw new Error(data.errorMessage ?? data.message ?? "Pesapal IPN registration failed");
  }

  return data.ipn_id;
}

export function buildIpnResponse(
  orderTrackingId: string,
  merchantReference: string,
  ok: boolean,
): string {
  return JSON.stringify({
    orderNotificationType: "IPNCHANGE",
    orderTrackingId,
    orderMerchantReference: merchantReference,
    status: ok ? 200 : 500,
  });
}
