import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { parseStkCallback } from "@/lib/api/mpesa";
import type { StkCallbackBody } from "@/lib/api/mpesa";
import { buildIpnResponse } from "@/lib/api/pesapal";
import { completePesapalPayment } from "@/lib/payments/complete-pesapal-payment";
import { parsePaymentMetadata } from "@/lib/payments/payment-metadata";
import { completeMpesaFromCallback } from "@/lib/payments/complete-mpesa-payment";

type Admin = SupabaseClient<Database>;

async function logWebhook(
  supabaseAdmin: Admin,
  provider: "mpesa" | "pesapal",
  payload: unknown,
  signatureValid: boolean,
  paymentId?: string,
) {
  try {
    await supabaseAdmin.from("payment_webhook_log").insert({
      provider,
      payment_id: paymentId ?? null,
      raw_payload: payload as Json,
      signature_valid: signatureValid,
      processed: false,
    });
  } catch (err) {
    console.warn("[payments] webhook log insert failed:", err);
  }
}

function parsePesapalIpn(
  request: Request,
  body?: Record<string, string>,
): {
  orderTrackingId: string;
  merchantReference: string;
} | null {
  const url = new URL(request.url);
  const orderTrackingId =
    body?.OrderTrackingId ??
    url.searchParams.get("OrderTrackingId") ??
    url.searchParams.get("orderTrackingId");
  const merchantReference =
    body?.OrderMerchantReference ??
    url.searchParams.get("OrderMerchantReference") ??
    url.searchParams.get("orderMerchantReference");

  if (!orderTrackingId || !merchantReference) return null;
  return { orderTrackingId, merchantReference };
}

async function parseJsonBody(request: Request): Promise<unknown> {
  return request.json();
}

export async function handleMpesaWebhook(request: Request): Promise<Response> {
  const webhookSecret = process.env.MPESA_WEBHOOK_SECRET;
  if (!webhookSecret && process.env.MPESA_ENV === "production") {
    console.warn(
      "[mpesa-webhook] MPESA_WEBHOOK_SECRET unset — set it and register callback with ?secret=…",
    );
  }
  if (webhookSecret) {
    const auth = request.headers.get("authorization");
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");
    const authorized = auth === `Bearer ${webhookSecret}` || querySecret === webhookSecret;
    if (!authorized) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const body = (await parseJsonBody(request)) as StkCallbackBody;
  const parsed = parseStkCallback(body);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await logWebhook(supabaseAdmin, "mpesa", body, Boolean(webhookSecret));
  if (!parsed) {
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  await completeMpesaFromCallback(
    supabaseAdmin,
    parsed.checkoutRequestId,
    parsed.success,
    parsed.mpesaReceipt,
  );

  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function handlePesapalWebhook(request: Request): Promise<Response> {
  let body: Record<string, string> | undefined;
  if (request.method === "POST") {
    try {
      body = (await parseJsonBody(request)) as Record<string, string>;
    } catch {
      body = undefined;
    }
  }

  const ipn = parsePesapalIpn(request, body);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await logWebhook(
    supabaseAdmin,
    "pesapal",
    body ?? Object.fromEntries(new URL(request.url).searchParams),
    true,
  );

  if (!ipn) {
    return new Response(JSON.stringify({ error: "Missing OrderTrackingId or OrderMerchantReference" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await completePesapalPayment(supabaseAdmin, ipn.merchantReference, ipn.orderTrackingId);
    return new Response(buildIpnResponse(ipn.orderTrackingId, ipn.merchantReference, true), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Pesapal IPN processing error:", err);
    return new Response(buildIpnResponse(ipn.orderTrackingId, ipn.merchantReference, false), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function handlePesapalRedirect(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const orderTrackingId = url.searchParams.get("OrderTrackingId");
  const merchantReference = url.searchParams.get("OrderMerchantReference");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getSiteUrl } = await import("@/lib/site");

  if (!orderTrackingId || !merchantReference) {
    return Response.redirect(`${getSiteUrl()}/tenant/checkout?card=failed`, 302);
  }

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("mpesa_checkout_id", merchantReference)
    .maybeSingle();

  const meta = parsePaymentMetadata(payment?.metadata);
  const { sanitizeAppPath } = await import("@/lib/payments/safe-app-path");
  const successPathRaw = sanitizeAppPath(
    meta.successPath ?? "/tenant/checkout?card=success",
    "/tenant/checkout?card=success",
  );
  const failPathRaw = sanitizeAppPath(
    meta.cancelPath ?? `${successPathRaw.split("?")[0]}?card=failed`,
    "/tenant/checkout?card=failed",
  );
  const site = getSiteUrl().replace(/\/$/, "");
  const toAbsolute = (path: string) => {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${site}${normalized}`;
  };
  const successPath = toAbsolute(successPathRaw);
  const failPath = toAbsolute(failPathRaw);

  if (!payment) {
    return Response.redirect(failPath, 302);
  }

  if (payment.status !== "completed") {
    await completePesapalPayment(supabaseAdmin, merchantReference, orderTrackingId);
    const { data: updated } = await supabaseAdmin
      .from("payments")
      .select("status")
      .eq("id", payment.id)
      .maybeSingle();
    if (updated?.status !== "completed") {
      return Response.redirect(failPath, 302);
    }
  }

  const sep = successPath.includes("?") ? "&" : "?";
  return Response.redirect(`${successPath}${sep}card=success&paymentId=${payment.id}`, 302);
}

export async function handleRenewalCron(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { runSubscriptionRenewalCron } = await import("@/lib/payments/renewal-cron");
  const stats = await runSubscriptionRenewalCron(supabaseAdmin);

  return new Response(JSON.stringify({ ok: true, stats }), {
    headers: { "Content-Type": "application/json" },
  });
}

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  return Boolean(secret && auth === `Bearer ${secret}`);
}

export async function handleDailyCron(request: Request): Promise<Response> {
  if (!authorizeCron(request)) return new Response("Unauthorized", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { runSubscriptionRenewalCron } = await import("@/lib/payments/renewal-cron");
  const { runTrialReminderCron, runReengagementCron, runSavedSearchDigestCron } =
    await import("@/lib/cron/marketing-cron");
  const { runEmailRetryCron } = await import("@/lib/cron/email-retry-cron");
  const { runViewingReminderCron } = await import("@/lib/cron/whatsapp-cron");
  const { runSalesBotCron } = await import("@/lib/cron/sales-cron");

  const { asPmDb } = await import("@/lib/pm/access");
  const { flagPmOverdueInvoices } = await import("@/lib/pm/cron");
  const { applyPmLateFees, sendPmRentReminders } = await import("@/lib/pm/rent-reminders");

  const pmDb = asPmDb(supabaseAdmin);

  const [
    renewals,
    trial,
    reengagement,
    savedSearch,
    emailRetry,
    viewingReminders,
    sales,
    pmOverdue,
    pmLateFees,
    pmReminders,
  ] = await Promise.all([
      runSubscriptionRenewalCron(supabaseAdmin),
      runTrialReminderCron(supabaseAdmin).catch((e) => {
        console.warn("[cron] trial reminders:", e);
        return { trialEnding: 0, trialExpired: 0 };
      }),
      runReengagementCron(supabaseAdmin).catch((e) => {
        console.warn("[cron] re-engagement:", e);
        return { sent: 0 };
      }),
      runSavedSearchDigestCron(supabaseAdmin).catch((e) => {
        console.warn("[cron] saved search digest:", e);
        return { sent: 0 };
      }),
      runEmailRetryCron(supabaseAdmin).catch((e) => {
        console.warn("[cron] email retry:", e);
        return { retried: 0, succeeded: 0 };
      }),
      runViewingReminderCron(supabaseAdmin).catch((e) => {
        console.warn("[cron] whatsapp viewing reminders:", e);
        return { tomorrow: 0, today: 0, skipped: true };
      }),
      runSalesBotCron(supabaseAdmin).catch((e) => {
        console.warn("[cron] sales bot:", e);
        return { upgrade: { sent: 0 }, landlord: { sent: 0 } };
      }),
      flagPmOverdueInvoices(pmDb).catch((e) => {
        console.warn("[cron] pm overdue invoices:", e);
        return { updated: 0 };
      }),
      applyPmLateFees(pmDb).catch((e) => {
        console.warn("[cron] pm late fees:", e);
        return { updated: 0 };
      }),
      sendPmRentReminders(pmDb).catch((e) => {
        console.warn("[cron] pm rent reminders:", e);
        return { sent: 0 };
      }),
    ]);

  return new Response(
    JSON.stringify({
      ok: true,
      renewals,
      marketing: { trial, reengagement, savedSearch },
      emailRetry,
      whatsapp: { viewingReminders },
      sales,
      pm: { overdue: pmOverdue, lateFees: pmLateFees, reminders: pmReminders },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

export async function handleWeeklyCron(request: Request): Promise<Response> {
  if (!authorizeCron(request)) return new Response("Unauthorized", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { runWeeklyDigestCron } = await import("@/lib/cron/marketing-cron");
  const digest = await runWeeklyDigestCron(supabaseAdmin);
  return new Response(JSON.stringify({ ok: true, digest }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleMonthlyCron(request: Request): Promise<Response> {
  if (!authorizeCron(request)) return new Response("Unauthorized", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { runMonthlyMarketTeaserCron } = await import("@/lib/cron/marketing-cron");
  const { asPmDb } = await import("@/lib/pm/access");
  const { generatePmMonthlyInvoices } = await import("@/lib/pm/cron");
  const [teaser, pmInvoices] = await Promise.all([
    runMonthlyMarketTeaserCron(supabaseAdmin),
    generatePmMonthlyInvoices(asPmDb(supabaseAdmin)).catch((e) => {
      console.warn("[cron] pm monthly invoices:", e);
      return { created: 0 };
    }),
  ]);
  return new Response(JSON.stringify({ ok: true, teaser, pm: { invoices: pmInvoices } }), {
    headers: { "Content-Type": "application/json" },
  });
}
