/**
 * IntaSend Send Money — bank (PesaLink), M-Pesa B2C (phone), and M-Pesa B2B (paybill/till).
 * Env: INTASEND_SECRET_KEY (required), INTASEND_ENV=sandbox|live (default live).
 */
import { getServerEnv } from "@/lib/server-env";

function secretKey(): string | null {
  return (
    getServerEnv("INTASEND_SECRET_KEY")?.trim() ||
    getServerEnv("INTASEND_API_KEY")?.trim() ||
    null
  );
}

export function isIntasendConfigured(): boolean {
  return Boolean(secretKey());
}

function apiBase(): string {
  const env = (getServerEnv("INTASEND_ENV") || "live").toLowerCase();
  return env === "sandbox"
    ? "https://sandbox.intasend.com/api/v1"
    : "https://payment.intasend.com/api/v1";
}

async function intasendFetch<T>(
  path: string,
  init: RequestInit & { method?: string } = {},
): Promise<{ ok: true; data: T } | { ok: false; message: string; status: number }> {
  const key = secretKey();
  if (!key) {
    return { ok: false, message: "IntaSend is not configured", status: 0 };
  }

  try {
    const res = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init.headers,
      },
    });
    const data = (await res.json().catch(() => null)) as
      | (T & {
          detail?: string;
          message?: string;
          error?: string | { message?: string };
        })
      | null;
    if (!res.ok) {
      const msg =
        (data && typeof data.error === "object" && data.error?.message) ||
        (data && typeof data.error === "string" ? data.error : null) ||
        data?.detail ||
        data?.message ||
        `IntaSend error ${res.status}`;
      return { ok: false, message: String(msg), status: res.status };
    }
    return { ok: true, data: (data ?? {}) as T };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "IntaSend request failed",
      status: 0,
    };
  }
}

export type IntasendBankCode = { bank_name: string; bank_code: string };

/** Fetch live bank codes from IntaSend (falls back to static list on failure). */
export async function fetchIntasendBankCodes(): Promise<IntasendBankCode[]> {
  const result = await intasendFetch<IntasendBankCode[]>("/send-money/bank-codes/ke/", {
    method: "GET",
  });
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data;
}

type ValidateAccountResponse = {
  account?: string;
  account_name?: string;
  name?: string;
  account_status?: string;
  message?: string;
};

/** Resolve bank account holder name via IntaSend (PesaLink). */
export async function resolveBankAccountName(opts: {
  accountNumber: string;
  bankCode: string;
}): Promise<{ ok: true; accountName: string } | { ok: false; message: string }> {
  if (!isIntasendConfigured()) {
    return {
      ok: false,
      message: "Bank name verification is not configured yet (set INTASEND_SECRET_KEY)",
    };
  }

  const result = await intasendFetch<ValidateAccountResponse>("/send-money/validate-accounts/", {
    method: "POST",
    body: JSON.stringify({
      account: opts.accountNumber,
      provider: "PESALINK",
      bank_code: String(opts.bankCode),
      country: "KE",
    }),
  });

  if (!result.ok) return { ok: false, message: result.message };

  const accountName = result.data.account_name || result.data.name;
  if (!accountName) {
    return { ok: false, message: result.data.message || "Could not resolve account name" };
  }
  return { ok: true, accountName };
}

type InitiateResponse = {
  tracking_id?: string;
  id?: string | number;
  batch_reference?: string;
  status?: string;
  message?: string;
  transactions?: Array<{ tracking_id?: string; status?: string }>;
};

function trackingIdFromResponse(data: InitiateResponse): string | null {
  return (
    data.tracking_id ||
    data.batch_reference ||
    (data.id != null ? String(data.id) : null) ||
    data.transactions?.[0]?.tracking_id ||
    null
  );
}

/**
 * Disburse KES to a Kenyan bank account via PesaLink.
 * Uses requires_approval=NO for automated straight-through processing.
 */
export async function createIntasendBankTransfer(opts: {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  amountKes: number;
  narration: string;
  batchReference: string;
}): Promise<{ ok: true; transferId: string } | { ok: false; message: string }> {
  if (!isIntasendConfigured()) {
    return { ok: false, message: "IntaSend is not configured for bank payouts" };
  }

  if (opts.amountKes < 100) {
    return { ok: false, message: "IntaSend bank payouts require at least KES 100" };
  }

  const result = await intasendFetch<InitiateResponse>("/send-money/initiate/", {
    method: "POST",
    body: JSON.stringify({
      currency: "KES",
      provider: "PESALINK",
      country: "KE",
      requires_approval: "NO",
      batch_reference: opts.batchReference,
      transactions: [
        {
          name: opts.accountName,
          account: opts.accountNumber,
          bank_code: String(opts.bankCode),
          amount: opts.amountKes,
          narrative: opts.narration.slice(0, 100),
        },
      ],
    }),
  });

  if (!result.ok) return { ok: false, message: result.message };

  const transferId = trackingIdFromResponse(result.data);
  if (!transferId) {
    return {
      ok: false,
      message: result.data.message || "IntaSend did not return a tracking id",
    };
  }

  return { ok: true, transferId: String(transferId) };
}

/** Send KES to a personal M-Pesa number (B2C). Phone must be 2547… / 2541…. */
export async function createIntasendMpesaB2C(opts: {
  phone254: string;
  amountKes: number;
  name?: string;
  narration: string;
  batchReference: string;
}): Promise<{ ok: true; transferId: string } | { ok: false; message: string }> {
  if (!isIntasendConfigured()) {
    return { ok: false, message: "IntaSend is not configured for M-Pesa payouts" };
  }
  if (opts.amountKes < 10) {
    return { ok: false, message: "M-Pesa payouts require at least KES 10" };
  }

  const account = opts.phone254.replaceAll(/\D/g, "");
  if (!/^254[71]\d{8}$/.test(account)) {
    return { ok: false, message: "M-Pesa phone must be a Safaricom number in 254 format" };
  }

  const result = await intasendFetch<InitiateResponse>("/send-money/initiate/", {
    method: "POST",
    body: JSON.stringify({
      currency: "KES",
      provider: "MPESA-B2C",
      country: "KE",
      requires_approval: "NO",
      batch_reference: opts.batchReference,
      transactions: [
        {
          name: (opts.name || "Landlord").slice(0, 50),
          account: Number(account),
          amount: opts.amountKes,
          narrative: opts.narration.slice(0, 100),
        },
      ],
    }),
  });

  if (!result.ok) return { ok: false, message: result.message };
  const transferId = trackingIdFromResponse(result.data);
  if (!transferId) {
    return { ok: false, message: result.data.message || "IntaSend did not return a tracking id" };
  }
  return { ok: true, transferId: String(transferId) };
}

/** Send KES to a Paybill or Till (B2B). */
export async function createIntasendMpesaB2B(opts: {
  accountType: "PayBill" | "TillNumber";
  account: string;
  accountReference?: string | null;
  amountKes: number;
  name?: string;
  narration: string;
  batchReference: string;
}): Promise<{ ok: true; transferId: string } | { ok: false; message: string }> {
  if (!isIntasendConfigured()) {
    return { ok: false, message: "IntaSend is not configured for M-Pesa payouts" };
  }
  if (opts.amountKes < 10) {
    return { ok: false, message: "M-Pesa payouts require at least KES 10" };
  }

  const account = opts.account.replaceAll(/\D/g, "");
  if (!account) return { ok: false, message: "Paybill / Till number is required" };
  if (opts.accountType === "PayBill" && !opts.accountReference?.trim()) {
    return { ok: false, message: "Paybill account reference is required" };
  }

  const txn: Record<string, string | number> = {
    name: (opts.name || "Landlord business").slice(0, 50),
    account: Number(account) || account,
    account_type: opts.accountType,
    amount: opts.amountKes,
    narrative: opts.narration.slice(0, 100),
  };
  if (opts.accountType === "PayBill" && opts.accountReference) {
    txn.account_reference = opts.accountReference.trim();
  }

  const result = await intasendFetch<InitiateResponse>("/send-money/initiate/", {
    method: "POST",
    body: JSON.stringify({
      currency: "KES",
      provider: "MPESA-B2B",
      country: "KE",
      requires_approval: "NO",
      batch_reference: opts.batchReference,
      transactions: [txn],
    }),
  });

  if (!result.ok) return { ok: false, message: result.message };
  const transferId = trackingIdFromResponse(result.data);
  if (!transferId) {
    return { ok: false, message: result.data.message || "IntaSend did not return a tracking id" };
  }
  return { ok: true, transferId: String(transferId) };
}
