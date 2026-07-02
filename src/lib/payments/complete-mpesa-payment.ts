import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { queryStkPushStatus } from "@/lib/api/mpesa";
import { fulfillPaymentRow } from "@/lib/revenue/fulfill-payment";

type Admin = SupabaseClient<Database>;
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

/** Poll Daraja STK status and fulfill when Safaricom confirms payment. */
export async function syncMpesaPaymentStatus(
  supabaseAdmin: Admin,
  payment: PaymentRow,
): Promise<PaymentRow> {
  if (payment.status !== "pending" || payment.payment_method !== "mpesa") {
    return payment;
  }

  const checkoutId = payment.mpesa_checkout_id;
  if (!checkoutId) return payment;

  const { isMpesaConfigured } = await import("@/lib/api/mpesa");
  if (!isMpesaConfigured()) return payment;

  const stk = await queryStkPushStatus(checkoutId);
  if (stk.status === "pending") return payment;

  if (stk.status === "failed") {
    const { data: updated } = await supabaseAdmin
      .from("payments")
      .update({ status: "failed" })
      .eq("id", payment.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    return updated ?? { ...payment, status: "failed" };
  }

  const receipt = stk.mpesaReceipt ?? checkoutId;
  const { data: completed } = await supabaseAdmin
    .from("payments")
    .update({
      status: "completed",
      mpesa_receipt: receipt,
    })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (!completed) return payment;

  await fulfillPaymentRow(supabaseAdmin, completed);
  if (completed.payment_type === "premium_subscription" && completed.user_id) {
    await supabaseAdmin
      .from("profiles")
      .update({ is_portal_active: true })
      .eq("id", completed.user_id);
  }

  const { queuePaymentEmails } = await import("@/lib/payments/payment-email-hook");
  queuePaymentEmails(supabaseAdmin, completed);

  if (completed.payment_type === "contact_unlock") {
    const { notifyWhatsAppContactUnlock } = await import("@/lib/whatsapp/notify-hooks");
    void notifyWhatsAppContactUnlock(supabaseAdmin, completed);
  }

  return completed;
}

export async function completeMpesaFromCallback(
  supabaseAdmin: Admin,
  checkoutRequestId: string,
  success: boolean,
  mpesaReceipt: string | null,
) {
  type PaymentUpdate = Database["public"]["Tables"]["payments"]["Update"];
  const patch: PaymentUpdate = {
    status: success ? "completed" : "failed",
  };
  if (mpesaReceipt) patch.mpesa_receipt = mpesaReceipt;

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .update(patch)
    .eq("mpesa_checkout_id", checkoutRequestId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (success && payment) {
    await fulfillPaymentRow(supabaseAdmin, payment);
    if (payment.payment_type === "premium_subscription" && payment.user_id) {
      await supabaseAdmin
        .from("profiles")
        .update({ is_portal_active: true })
        .eq("id", payment.user_id);
    }
    const { queuePaymentEmails } = await import("@/lib/payments/payment-email-hook");
    queuePaymentEmails(supabaseAdmin, payment);
    if (payment.payment_type === "contact_unlock") {
      const { notifyWhatsAppContactUnlock } = await import("@/lib/whatsapp/notify-hooks");
      void notifyWhatsAppContactUnlock(supabaseAdmin, payment);
    }
  }

  return payment;
}
