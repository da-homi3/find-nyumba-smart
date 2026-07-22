import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getTransactionStatus } from "@/lib/api/pesapal";
import { fulfillPaymentRow } from "@/lib/revenue/fulfill-payment";
import { parsePaymentMetadata } from "@/lib/payments/payment-metadata";

type Admin = SupabaseClient<Database>;
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

/** Complete a pending card payment after Pesapal confirms success. */
export async function completePesapalPayment(
  supabaseAdmin: Admin,
  merchantReference: string,
  orderTrackingId: string,
): Promise<PaymentRow | null> {
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("mpesa_checkout_id", merchantReference)
    .maybeSingle();

  if (!payment || payment.status === "completed") return payment;

  const verified = await getTransactionStatus(orderTrackingId);
  if (verified.status !== "success" || verified.amountKes < payment.amount_kes) {
    if (verified.status === "failed") {
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed" })
        .eq("id", payment.id)
        .eq("status", "pending");
    }
    return null;
  }

  const { data: completed } = await supabaseAdmin
    .from("payments")
    .update({
      status: "completed",
      mpesa_receipt: verified.confirmationCode ?? orderTrackingId,
    })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (!completed) return null;

  await fulfillPaymentRow(supabaseAdmin, completed);

  const { queuePaymentEmails } = await import("@/lib/payments/payment-email-hook");
  queuePaymentEmails(supabaseAdmin, completed);

  return completed;
}

/** Poll Pesapal when the client verifies a pending card payment. */
export async function syncPesapalPaymentStatus(
  supabaseAdmin: Admin,
  payment: PaymentRow,
): Promise<PaymentRow> {
  if (payment.status !== "pending" || payment.payment_method !== "card") {
    return payment;
  }

  const meta = parsePaymentMetadata(payment.metadata);
  const orderTrackingId = meta.orderTrackingId;
  const merchantReference = payment.mpesa_checkout_id;
  if (!orderTrackingId || !merchantReference) return payment;

  const { isPesapalConfigured } = await import("@/lib/api/pesapal");
  if (!isPesapalConfigured()) return payment;

  const completed = await completePesapalPayment(supabaseAdmin, merchantReference, orderTrackingId);
  if (completed) return completed;

  const { data: refreshed } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("id", payment.id)
    .maybeSingle();
  return refreshed ?? payment;
}
