import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { mpesaCallbackAmountMatches, queryStkPushStatus } from "@/lib/api/mpesa";
import { fulfillPaymentRow } from "@/lib/revenue/fulfill-payment";
import { parsePaymentMetadata } from "@/lib/payments/payment-metadata";

type Admin = SupabaseClient<Database>;
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

function usesIntasendStk(payment: PaymentRow): boolean {
  const meta = parsePaymentMetadata(payment.metadata);
  if (meta.mpesaProvider === "intasend") return true;
  if (meta.mpesaProvider === "daraja") return false;
  // Heuristic: rent payments without explicit provider → prefer IntaSend id style
  return payment.payment_type === "rent_payment";
}

/** Poll Daraja / IntaSend STK status and fulfill when payment confirms. */
export async function syncMpesaPaymentStatus(
  supabaseAdmin: Admin,
  payment: PaymentRow,
): Promise<PaymentRow> {
  if (payment.status !== "pending" || payment.payment_method !== "mpesa") {
    return payment;
  }

  const checkoutId = payment.mpesa_checkout_id;
  if (!checkoutId) return payment;

  let stkStatus: "success" | "pending" | "failed";
  let mpesaReceipt: string | undefined;

  if (usesIntasendStk(payment)) {
    const { queryIntasendPaymentStatus } = await import("@/lib/pm/intasend-collect");
    const stk = await queryIntasendPaymentStatus(checkoutId);
    console.info("[mpesa-sync] IntaSend", payment.id, checkoutId, stk.status, stk.resultDesc ?? "");
    stkStatus = stk.status;
    mpesaReceipt = stk.mpesaReceipt;
  } else {
    const { isMpesaConfigured } = await import("@/lib/api/mpesa");
    if (!isMpesaConfigured()) return payment;
    const stk = await queryStkPushStatus(checkoutId);
    stkStatus = stk.status;
    mpesaReceipt = stk.mpesaReceipt;
  }

  if (stkStatus === "pending") return payment;

  if (stkStatus === "failed") {
    const { data: updated } = await supabaseAdmin
      .from("payments")
      .update({ status: "failed" })
      .eq("id", payment.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    return updated ?? { ...payment, status: "failed" };
  }

  const receipt = mpesaReceipt ?? checkoutId;
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
  paidAmountKes?: number | null,
) {
  // Fulfilling on a success flag alone would grant the full order value regardless of what
  // was actually paid. Confirm the callback amount matches before crediting anything.
  if (success && paidAmountKes != null) {
    const { data: pending } = await supabaseAdmin
      .from("payments")
      .select("id, amount_kes")
      .eq("mpesa_checkout_id", checkoutRequestId)
      .eq("status", "pending")
      .maybeSingle();

    if (pending && !mpesaCallbackAmountMatches(paidAmountKes, pending.amount_kes)) {
      console.error("[mpesa] callback amount mismatch — not fulfilling", {
        paymentId: pending.id,
        expected: pending.amount_kes,
        paid: paidAmountKes,
      });
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed" })
        .eq("id", pending.id)
        .eq("status", "pending");
      return null;
    }
  }

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
