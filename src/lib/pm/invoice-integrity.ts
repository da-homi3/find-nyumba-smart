/**
 * Invoice integrity — the ONLY permitted writer of pm_rent_invoices.amount_paid.
 * Payment rows are append-only; corrections are reversal inserts (negative amount).
 */
import type { PmDb } from "@/lib/pm/access";
import { invoiceStatusAfterPayment } from "@/lib/pm/invoice-status";

export async function recomputeInvoiceStatus(admin: PmDb, invoiceId: string): Promise<{
  status: string;
  amountPaid: number;
}> {
  const { data: pays } = await admin
    .from("pm_rent_payments")
    .select("amount")
    .eq("invoice_id", invoiceId);

  const amountPaid = (pays ?? []).reduce(
    (sum: number, row: { amount: number }) => sum + Number(row.amount),
    0,
  );

  const { data: invoice } = await admin
    .from("pm_rent_invoices")
    .select("amount_due, late_fee")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) throw new Error("Invoice not found");

  const lateFee = Number(invoice.late_fee ?? 0);
  const status = invoiceStatusAfterPayment(Number(invoice.amount_due), amountPaid, lateFee);

  const { error } = await admin
    .from("pm_rent_invoices")
    .update({ amount_paid: amountPaid, status })
    .eq("id", invoiceId);
  if (error) throw error;

  return { status, amountPaid };
}

export async function createPaymentReversal(
  admin: PmDb,
  opts: {
    originalPaymentId: string;
    reason: string;
    recordedByUserId: string;
  },
): Promise<{ success: true; reversalId: string; status: string; amountPaid: number }> {
  const { data: original } = await admin
    .from("pm_rent_payments")
    .select("*")
    .eq("id", opts.originalPaymentId)
    .maybeSingle();

  if (!original) throw new Error("Payment not found");
  if (original.is_reversal) {
    throw new Error("Cannot reverse a reversal — contact admin for correction");
  }

  const amount = -Math.abs(Number(original.amount));
  const { data: reversal, error } = await admin
    .from("pm_rent_payments")
    .insert({
      invoice_id: original.invoice_id,
      amount,
      method: "manual",
      recorded_by_user_id: opts.recordedByUserId,
      is_reversal: true,
      reversal_of_payment_id: opts.originalPaymentId,
      reversal_reason: opts.reason,
      note: `Reversal of payment ${opts.originalPaymentId}`,
    })
    .select("id")
    .single();

  if (error) throw error;

  const reconciled = await recomputeInvoiceStatus(admin, original.invoice_id as string);

  // Best-effort audit trail via existing admin audit logs when available
  try {
    await admin.from("admin_audit_logs").insert({
      admin_id: opts.recordedByUserId,
      action: "payment_reversal",
      target_id: opts.originalPaymentId,
      details: JSON.stringify({
        reason: opts.reason,
        amount: original.amount,
        reversalId: reversal.id,
      }),
    });
  } catch {
    // best-effort — reversal row itself is the source of truth
  }

  return { success: true, reversalId: reversal.id, ...reconciled };
}
