import { getSiteUrl } from "@/lib/site";

type StkPushResult = {
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage: string;
};

function mpesaBaseUrl() {
  const env = process.env.MPESA_ENV ?? "sandbox";
  return env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

export function isMpesaConfigured(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_SHORTCODE &&
    process.env.MPESA_PASSKEY,
  );
}

export function mpesaCallbackUrl(): string {
  if (process.env.MPESA_CALLBACK_URL) return process.env.MPESA_CALLBACK_URL;
  return `${getSiteUrl()}/api/mpesa/callback`;
}

async function getAccessToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY!;
  const secret = process.env.MPESA_CONSUMER_SECRET!;
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${mpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new Error(`M-Pesa OAuth failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  const token =
    typeof json === "object" && json !== null && "access_token" in json
      ? String((json as { access_token: unknown }).access_token)
      : "";
  if (!token) throw new Error("M-Pesa OAuth missing access_token");
  return token;
}

function stkPassword(): { password: string; timestamp: string } {
  const shortcode = process.env.MPESA_SHORTCODE!;
  const passkey = process.env.MPESA_PASSKEY!;
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  return { password, timestamp };
}

export async function initiateStkPush(opts: {
  phone254: string;
  amountKes: number;
  accountReference: string;
  transactionDesc: string;
}): Promise<StkPushResult> {
  const token = await getAccessToken();
  const { password, timestamp } = stkPassword();
  const shortcode = process.env.MPESA_SHORTCODE!;

  const res = await fetch(`${mpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
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

  const json = (await res.json()) as {
    CheckoutRequestID?: string;
    MerchantRequestID?: string;
    CustomerMessage?: string;
    errorMessage?: string;
  };

  if (!res.ok || !json.CheckoutRequestID) {
    throw new Error(json.errorMessage ?? json.CustomerMessage ?? "STK Push failed");
  }

  return {
    checkoutRequestId: json.CheckoutRequestID,
    merchantRequestId: json.MerchantRequestID ?? "",
    customerMessage: json.CustomerMessage ?? "Check your phone for the M-Pesa prompt.",
  };
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
