/**
 * IntaSend M-Pesa STK collection (receive money).
 * Used for rent_payment prompts so funds land in the IntaSend wallet for landlord payouts.
 *
 * Cloudflare Workers are IP-banned by IntaSend (error 1106), so production uses the
 * Supabase Edge proxy (`intasend-proxy`) when configured.
 */
import { getServerEnv } from "@/lib/server-env";
import { isIntasendConfigured } from "@/lib/pm/intasend-payout";
import { getSiteUrl } from "@/lib/site";
import {
  intasendProxyConfigured,
  intasendProxyFetch,
  isIntasendIpBanResponse,
} from "@/lib/pm/intasend-proxy";

export { isIntasendConfigured as isIntasendCollectionConfigured };

function secretKey(): string | null {
  return (
    getServerEnv("INTASEND_SECRET_KEY")?.trim() || getServerEnv("INTASEND_API_KEY")?.trim() || null
  );
}

function publishableKey(): string | null {
  return (
    getServerEnv("INTASEND_PUBLISHABLE_KEY")?.trim() ||
    getServerEnv("INTASEND_PUBLIC_KEY")?.trim() ||
    null
  );
}

function collectionBases(): string[] {
  const env = (getServerEnv("INTASEND_ENV") || "live").toLowerCase();
  if (env === "sandbox") {
    return ["https://sandbox.intasend.com/api/v1"];
  }
  return ["https://payment.intasend.com/api/v1", "https://api.intasend.com/api/v1"];
}

type StkInitResponse = {
  id?: string;
  invoice?: {
    invoice_id?: string;
    id?: string;
    state?: string;
    mpesa_reference?: string | null;
    failed_reason?: string | null;
    api_ref?: string | null;
  };
  message?: string;
  detail?: string;
  errors?: Array<{ detail?: string; code?: string }>;
};

type StatusResponse = {
  invoice?: {
    invoice_id?: string;
    id?: string;
    state?: string;
    mpesa_reference?: string | null;
    failed_reason?: string | null;
    value?: string;
  };
};

function messageFromStkBody(data: StkInitResponse): string | null {
  const fromList = data.errors
    ?.map((e) => e.detail || e.code)
    .filter(Boolean)
    .join("; ");
  if (fromList) {
    if (/insufficient|balance/i.test(fromList)) {
      return "Rent collection wallet issue at IntaSend. Please try again shortly or contact support.";
    }
    return fromList;
  }
  return data.detail || data.message || null;
}

function messageFromHttpStatus(status: number, rawText?: string): string {
  if (isIntasendIpBanResponse(status, rawText || "")) {
    return "Rent M-Pesa provider is blocking our server network. Support has been notified — try again shortly.";
  }
  if (status === 401) {
    return "Rent M-Pesa is temporarily unavailable (IntaSend auth). Please try again in a minute.";
  }
  if (status === 403) {
    return "Rent M-Pesa could not reach IntaSend from the server. Please try again shortly.";
  }
  if (status >= 500) {
    return "Rent M-Pesa provider is temporarily down. Please try again shortly.";
  }
  if (rawText?.trim() && rawText.length < 200 && !rawText.includes("<")) {
    return rawText.trim();
  }
  return `Could not start rent M-Pesa prompt (HTTP ${status || "error"}). Try again.`;
}

function errorMessage(data: StkInitResponse | null, status: number, rawText?: string): string {
  const fromBody = data ? messageFromStkBody(data) : null;
  return fromBody || messageFromHttpStatus(status, rawText);
}

function sanitizeApiRef(ref: string): string {
  return ref.replaceAll(/[^a-zA-Z0-9\-_: ]/g, "").slice(0, 140);
}

export type IntasendStkResult = {
  invoiceId: string;
  state: string;
  customerMessage: string;
};

function authHeaders(): Record<string, string> {
  const key = secretKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "NyumbaSearch/1.0 (+https://nyumbasearch.com)",
  };
  if (key) headers.Authorization = `Bearer ${key}`;
  const pub = publishableKey();
  if (pub) headers.INTASEND_PUBLIC_API_KEY = pub;
  return headers;
}

function parseStkJson(raw: string): StkInitResponse | null {
  try {
    return JSON.parse(raw) as StkInitResponse;
  } catch {
    return null;
  }
}

function stkResultFromResponse(data: StkInitResponse): IntasendStkResult {
  const invoiceId = data.invoice?.invoice_id || data.invoice?.id || data.id;
  if (!invoiceId) {
    throw new Error("IntaSend STK did not return an invoice id");
  }
  return {
    invoiceId: String(invoiceId),
    state: data.invoice?.state ?? "PENDING",
    customerMessage: "Check your phone for the M-Pesa prompt",
  };
}

function buildStkPayload(opts: {
  phone: string;
  amountKes: number;
  apiRef: string;
  narrative?: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    amount: opts.amountKes,
    phone_number: opts.phone,
    api_ref: sanitizeApiRef(opts.apiRef),
    method: "M-PESA",
    currency: "KES",
    mobile_tarrif: "BUSINESS-PAYS",
    host: getSiteUrl(),
  };
  if (opts.narrative) payload.narrative = sanitizeApiRef(opts.narrative).slice(0, 40);
  const pub = publishableKey();
  if (pub) payload.public_key = pub;
  return payload;
}

async function postStkViaProxy(
  body: Record<string, unknown>,
): Promise<
  | { ok: true; data: StkInitResponse }
  | { ok: false; status: number; data: StkInitResponse | null; raw: string }
> {
  const proxied = await intasendProxyFetch({
    path: "/payment/mpesa-stk-push/",
    method: "POST",
    body,
  });
  const data = parseStkJson(proxied.text);
  if (!proxied.ok) return { ok: false, status: proxied.status, data, raw: proxied.text };
  return { ok: true, data: data ?? {} };
}

async function postStkDirect(
  base: string,
  body: Record<string, unknown>,
): Promise<
  | { ok: true; data: StkInitResponse }
  | { ok: false; status: number; data: StkInitResponse | null; raw: string }
> {
  if (!secretKey()) {
    return { ok: false, status: 0, data: null, raw: "IntaSend is not configured" };
  }
  const res = await fetch(`${base}/payment/mpesa-stk-push/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  const data = parseStkJson(raw);
  if (!res.ok) return { ok: false, status: res.status, data, raw };
  return { ok: true, data: data ?? {} };
}

async function initiateStkViaDirectBases(
  payload: Record<string, unknown>,
): Promise<IntasendStkResult> {
  let lastFail: { status: number; data: StkInitResponse | null; raw: string } | null = null;
  for (const base of collectionBases()) {
    const result = await postStkDirect(base, payload);
    if (result.ok) return stkResultFromResponse(result.data);
    lastFail = result;
    console.warn("[intasend-collect] direct STK failed", base, result.status);
    if (
      !isIntasendIpBanResponse(result.status, result.raw) &&
      result.status !== 401 &&
      result.status < 500
    ) {
      break;
    }
  }
  throw new Error(errorMessage(lastFail?.data ?? null, lastFail?.status ?? 0, lastFail?.raw));
}

/** Trigger M-Pesa STK Push via IntaSend collection. */
export async function initiateIntasendStkPush(opts: {
  phone254: string;
  amountKes: number;
  apiRef: string;
  narrative?: string;
}): Promise<IntasendStkResult> {
  if (opts.amountKes < 1) throw new Error("Minimum STK push amount is KES 1");
  if (!isIntasendConfigured() && !intasendProxyConfigured()) {
    throw new Error("IntaSend is not configured for rent M-Pesa prompts");
  }

  const phone = opts.phone254.replaceAll(/\D/g, "");
  if (!/^254[71]\d{8}$/.test(phone)) {
    throw new Error("Enter a valid Safaricom number for M-Pesa");
  }

  const payload = buildStkPayload({
    phone,
    amountKes: opts.amountKes,
    apiRef: opts.apiRef,
    narrative: opts.narrative,
  });

  // Prefer edge proxy on Workers (IntaSend bans CF Worker IPs).
  if (intasendProxyConfigured()) {
    const viaProxy = await postStkViaProxy(payload);
    if (viaProxy.ok) return stkResultFromResponse(viaProxy.data);
    console.warn(
      "[intasend-collect] proxy STK failed",
      viaProxy.status,
      viaProxy.raw.slice(0, 160),
    );
    // Fall through to direct only if proxy itself is down (5xx/0), not on IntaSend 4xx.
    if (viaProxy.status > 0 && viaProxy.status < 500) {
      throw new Error(errorMessage(viaProxy.data, viaProxy.status, viaProxy.raw));
    }
  }

  return initiateStkViaDirectBases(payload);
}

/** Worker/diag: probe IntaSend wallets (+ optional STK) via proxy then direct. */
export async function probeIntasendFromWorker(opts?: {
  phone254?: string;
  amountKes?: number;
}): Promise<{
  configured: boolean;
  secretPresent: boolean;
  publishablePresent: boolean;
  proxyConfigured: boolean;
  wallets: Array<{ via: string; status: number; kesAvailable: number | null; rawSlice: string }>;
  stk: Array<{ via: string; status: number; rawSlice: string }>;
}> {
  const secretPresent = Boolean(secretKey());
  const publishablePresent = Boolean(publishableKey());
  const proxyConfigured = intasendProxyConfigured();
  const wallets: Array<{
    via: string;
    status: number;
    kesAvailable: number | null;
    rawSlice: string;
  }> = [];
  const stk: Array<{ via: string; status: number; rawSlice: string }> = [];

  const readKes = (raw: string): number | null => {
    try {
      const data = JSON.parse(raw) as
        | Array<{ currency?: string; available_balance?: string | number }>
        | { results?: Array<{ currency?: string; available_balance?: string | number }> };
      let rows: Array<{ currency?: string; available_balance?: string | number }> = [];
      if (Array.isArray(data)) rows = data;
      else if (Array.isArray(data.results)) rows = data.results;
      const kes = rows.find((w) => String(w.currency || "").toUpperCase() === "KES");
      if (!kes) return null;
      return Number.parseFloat(String(kes.available_balance ?? 0)) || 0;
    } catch {
      return null;
    }
  };

  if (proxyConfigured) {
    const proxied = await intasendProxyFetch({ path: "/wallets/", method: "GET" });
    wallets.push({
      via: "proxy",
      status: proxied.status,
      kesAvailable: readKes(proxied.text),
      rawSlice: proxied.text.slice(0, 120).replaceAll(/\s+/g, " "),
    });
  }

  for (const base of collectionBases()) {
    try {
      const res = await fetch(`${base}/wallets/`, { method: "GET", headers: authHeaders() });
      const raw = await res.text();
      wallets.push({
        via: base,
        status: res.status,
        kesAvailable: readKes(raw),
        rawSlice: raw.slice(0, 120).replaceAll(/\s+/g, " "),
      });
    } catch (e) {
      wallets.push({
        via: base,
        status: 0,
        kesAvailable: null,
        rawSlice: e instanceof Error ? e.message : "fetch failed",
      });
    }
  }

  const phone = opts?.phone254?.replaceAll(/\D/g, "");
  const amount = opts?.amountKes ?? 10;
  if (phone && /^254[71]\d{8}$/.test(phone) && amount >= 1) {
    try {
      const result = await initiateIntasendStkPush({
        phone254: phone,
        amountKes: amount,
        apiRef: `probe-worker-${Date.now().toString(36)}`,
        narrative: "worker-probe",
      });
      stk.push({ via: "initiate", status: 200, rawSlice: JSON.stringify(result).slice(0, 160) });
    } catch (e) {
      stk.push({
        via: "initiate",
        status: 0,
        rawSlice: e instanceof Error ? e.message : "failed",
      });
    }
  }

  return {
    configured: secretPresent || proxyConfigured,
    secretPresent,
    publishablePresent,
    proxyConfigured,
    wallets,
    stk,
  };
}

export type IntasendPaymentQuery = {
  status: "success" | "pending" | "failed";
  mpesaReceipt?: string;
  resultDesc?: string;
};

/** Poll IntaSend collection invoice status. */
export async function queryIntasendPaymentStatus(invoiceId: string): Promise<IntasendPaymentQuery> {
  if (!isIntasendConfigured() && !intasendProxyConfigured()) {
    return { status: "pending", resultDesc: "IntaSend not configured" };
  }

  const tryParse = (raw: string, ok: boolean): IntasendPaymentQuery | null => {
    if (!ok) return null;
    let data: StatusResponse & { state?: string; mpesa_reference?: string | null };
    try {
      data = JSON.parse(raw) as StatusResponse & {
        state?: string;
        mpesa_reference?: string | null;
      };
    } catch {
      return null;
    }
    const invoice = data.invoice;
    const state = String(invoice?.state || data.state || "").toUpperCase();
    if (!state) return null;

    if (state === "COMPLETE" || state === "COMPLETED" || state === "SUCCESS") {
      return {
        status: "success",
        mpesaReceipt: invoice?.mpesa_reference || data.mpesa_reference || invoiceId,
        resultDesc: "Payment confirmed",
      };
    }
    if (
      state === "FAILED" ||
      state === "CANCELED" ||
      state === "CANCELLED" ||
      state === "DECLINED"
    ) {
      return {
        status: "failed",
        resultDesc: invoice?.failed_reason || `Payment ${state.toLowerCase()}`,
      };
    }
    // PENDING, PROCESSING, CLEARING, etc.
    return { status: "pending", resultDesc: `Status: ${state}` };
  };

  if (intasendProxyConfigured()) {
    const proxied = await intasendProxyFetch({
      path: "/payment/status/",
      method: "POST",
      body: { invoice_id: invoiceId },
    });
    try {
      const parsed = tryParse(proxied.text, proxied.ok);
      if (parsed) return parsed;
      if (!proxied.ok) {
        console.warn(
          "[intasend-collect] status proxy failed",
          proxied.status,
          proxied.text.slice(0, 160),
        );
      }
    } catch (e) {
      console.warn("[intasend-collect] status proxy parse failed", e);
    }
  }

  for (const base of collectionBases()) {
    try {
      const res = await fetch(`${base}/payment/status/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const raw = await res.text();
      const parsed = tryParse(raw, res.ok);
      if (parsed) return parsed;
    } catch {
      // try next
    }
  }
  return { status: "pending", resultDesc: "Waiting for IntaSend confirmation" };
}
