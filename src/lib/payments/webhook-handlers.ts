import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { parseStkCallback } from "@/lib/api/mpesa";
import type { StkCallbackBody } from "@/lib/api/mpesa";
import { buildIpnResponse, getTransactionStatus } from "@/lib/api/pesapal";
import { fulfillPaymentRow } from "@/lib/revenue/fulfill-payment";
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
  await supabaseAdmin.from("payment_webhook_log").insert({
    provider,
    payment_id: paymentId ?? null,
    raw_payload: payload as Json,
    signature_valid: signatureValid,
    processed: false,
  });
}

function parsePesapalIpn(request: Request, body?: Record<string, string>): {
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
  const body = (await parseJsonBody(request)) as StkCallbackBody;
  const parsed = parseStkCallback(body);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await logWebhook(supabaseAdmin, "mpesa", body, true);

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

  await logWebhook(supabaseAdmin, "pesapal", body ?? Object.fromEntries(new URL(request.url).searchParams), true);

  if (!ipn) {
    return new Response(buildIpnResponse("", "", false), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await completePesapalPayment(supabaseAdmin, ipn.merchantReference, ipn.orderTrackingId);
    return new Response(
      buildIpnResponse(ipn.orderTrackingId, ipn.merchantReference, true),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Pesapal IPN processing error:", err);
    return new Response(
      buildIpnResponse(ipn.orderTrackingId, ipn.merchantReference, false),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

async function completePesapalPayment(
  supabaseAdmin: Admin,
  merchantReference: string,
  orderTrackingId: string,
) {
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("mpesa_checkout_id", merchantReference)
    .maybeSingle();

  if (!payment || payment.status === "completed") return;

  const verified = await getTransactionStatus(orderTrackingId);
  if (verified.status !== "success" || verified.amountKes < payment.amount_kes) {
    if (verified.status === "failed") {
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    }
    return;
  }

  await supabaseAdmin
    .from("payments")
    .update({
      status: "completed",
      mpesa_receipt: verified.confirmationCode ?? orderTrackingId,
    })
    .eq("id", payment.id);

  await fulfillPaymentRow(supabaseAdmin, payment);
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
  const successPath = meta.successPath ?? "/tenant/checkout?card=success";
  const failPath = meta.cancelPath ?? `${successPath.split("?")[0]}?card=failed`;

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
  return Response.redirect(`${successPath}${sep}card=success`, 302);
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
