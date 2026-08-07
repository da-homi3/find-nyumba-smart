/**
 * IntaSend Send Money — bank (PesaLink), M-Pesa B2C (phone), and M-Pesa B2B (paybill/till).
 * Env: INTASEND_SECRET_KEY (required), INTASEND_ENV=sandbox|live (default live).
 * Production Workers use Supabase edge proxy when IntaSend bans CF egress (error 1106).
 */
import { getServerEnv } from "@/lib/server-env";
import { intasendProxyConfigured, intasendProxyFetch } from "@/lib/pm/intasend-proxy";

/** Typical IntaSend M-Pesa B2C/B2B charge for small amounts (from live API errors). */
export const INTASEND_MPESA_PAYOUT_CHARGE_ESTIMATE_KES = 10;

function secretKey(): string | null {
  return (
    getServerEnv("INTASEND_SECRET_KEY")?.trim() || getServerEnv("INTASEND_API_KEY")?.trim() || null
  );
}

export function isIntasendConfigured(): boolean {
  return Boolean(secretKey()) || intasendProxyConfigured();
}

function payoutBases(): string[] {
  const env = (getServerEnv("INTASEND_ENV") || "live").toLowerCase();
  if (env === "sandbox") return ["https://sandbox.intasend.com/api/v1"];
  return ["https://payment.intasend.com/api/v1", "https://api.intasend.com/api/v1"];
}

function intasendFailureMessage(
  data: {
    detail?: string;
    message?: string;
    error?: string | { message?: string };
    errors?: Array<{ detail?: string; code?: string }>;
  } | null,
  status: number,
): string {
  const fromList = data?.errors
    ?.map((e) => e.detail || e.code)
    .filter(Boolean)
    .join("; ");
  if (fromList) return fromList;
  if (data && typeof data.error === "object" && data.error?.message)
    return String(data.error.message);
  if (data && typeof data.error === "string") return data.error;
  if (data?.detail) return data.detail;
  if (data?.message) return data.message;
  return `IntaSend error ${status}`;
}

type IntasendFailBody = Parameters<typeof intasendFailureMessage>[0];
type IntasendFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status: number };

function parseJsonOrNull(text: string): IntasendFailBody {
  try {
    return JSON.parse(text) as IntasendFailBody;
  } catch {
    return null;
  }
}

function parseJsonAs<T>(text: string): T {
  try {
    return (JSON.parse(text) ?? {}) as T;
  } catch {
    return {} as T;
  }
}

async function intasendFetchViaProxy<T>(
  path: string,
  method: string,
  body: unknown,
): Promise<IntasendFetchResult<T> | null> {
  if (!intasendProxyConfigured()) return null;

  const proxied = await intasendProxyFetch({ path, method, body });
  if (proxied.ok) {
    return { ok: true, data: parseJsonAs<T>(proxied.text) };
  }

  const data = parseJsonOrNull(proxied.text);
  const message =
    intasendFailureMessage(data, proxied.status) ||
    proxied.text.slice(0, 200) ||
    `IntaSend proxy error ${proxied.status}`;

  // Retry direct only when proxy itself is down (5xx/0).
  if (proxied.status > 0 && proxied.status < 500) {
    return { ok: false, message, status: proxied.status };
  }
  return null;
}

async function intasendFetchViaDirect<T>(
  path: string,
  init: RequestInit & { method?: string },
): Promise<IntasendFetchResult<T>> {
  const key = secretKey();
  if (!key) {
    return { ok: false, message: "IntaSend is not configured", status: 0 };
  }

  let last: { ok: false; message: string; status: number } | null = null;
  for (const base of payoutBases()) {
    try {
      const res = await fetch(`${base}${path}`, {
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
            errors?: Array<{ detail?: string; code?: string }>;
          })
        | null;
      if (!res.ok) {
        last = { ok: false, message: intasendFailureMessage(data, res.status), status: res.status };
        if (res.status === 401 || res.status === 403 || res.status >= 500) continue;
        return last;
      }
      return { ok: true, data: (data ?? {}) as T };
    } catch (e) {
      last = {
        ok: false,
        message: e instanceof Error ? e.message : "IntaSend request failed",
        status: 0,
      };
    }
  }
  return last ?? { ok: false, message: "IntaSend request failed", status: 0 };
}

async function intasendFetch<T>(
  path: string,
  init: RequestInit & { method?: string } = {},
): Promise<IntasendFetchResult<T>> {
  const method = (init.method || "GET").toUpperCase();
  let body: unknown;
  if (typeof init.body === "string" && init.body) {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = init.body;
    }
  }

  const viaProxy = await intasendFetchViaProxy<T>(path, method, body);
  if (viaProxy) return viaProxy;

  return intasendFetchViaDirect<T>(path, init);
}

type WalletRow = {
  wallet_id?: string;
  id?: string | number;
  currency?: string;
  wallet_type?: string;
  current_balance?: string | number;
  available_balance?: string | number;
  can_disburse?: boolean | string;
  label?: string;
};

function parseBalance(value: string | number | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Available KES balance on the IntaSend wallet used for disbursements. */
export async function getIntasendKesAvailableBalance(): Promise<{
  available: number;
  current: number;
  walletId: string | null;
} | null> {
  if (!isIntasendConfigured()) return null;
  const result = await intasendFetch<
    WalletRow[] | { results?: WalletRow[]; wallets?: WalletRow[] }
  >("/wallets/", { method: "GET" });
  if (!result.ok) {
    console.warn("[intasend] wallet list failed:", result.message);
    return null;
  }
  let rows: WalletRow[] = [];
  if (Array.isArray(result.data)) {
    rows = result.data;
  } else if (Array.isArray(result.data.results)) {
    rows = result.data.results;
  } else if (Array.isArray(result.data.wallets)) {
    rows = result.data.wallets;
  }
  const kes = rows.find((w) => String(w.currency || "").toUpperCase() === "KES") || null;
  if (!kes) return { available: 0, current: 0, walletId: null };
  let walletId: string | null = null;
  if (kes.wallet_id != null) walletId = String(kes.wallet_id);
  else if (kes.id != null) walletId = String(kes.id);
  return {
    available: parseBalance(kes.available_balance),
    current: parseBalance(kes.current_balance),
    walletId,
  };
}

/** Net payout + estimated IntaSend charge that must be available before sending. */
export function intasendPayoutRequiredBalanceKes(netAmountKes: number): number {
  return Math.ceil(netAmountKes + INTASEND_MPESA_PAYOUT_CHARGE_ESTIMATE_KES);
}

/**
 * Throws a clear error if the KES wallet cannot cover net + estimated charge.
 * Skips the check (returns) if the wallet API is unreachable so we still attempt disburse.
 */
export async function assertIntasendWalletForPayout(opts: { netAmountKes: number }): Promise<void> {
  const required = intasendPayoutRequiredBalanceKes(opts.netAmountKes);
  const wallet = await getIntasendKesAvailableBalance();
  if (!wallet) return;
  if (wallet.available + 0.001 >= required) return;
  throw new Error(
    `IntaSend wallet insufficient: need ~KES ${required} (net ${opts.netAmountKes} + charge) but available is KES ${wallet.available.toFixed(2)}. Top up the IntaSend KES wallet.`,
  );
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
          account: account,
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
    account: account,
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
