/**
 * Invoice integrity — the ONLY permitted writer of pm_rent_invoices.amount_paid.
 * Payment rows are append-only; corrections are reversal inserts (negative amount).
 */
import type { PmDb } from "@/lib/pm/access";
import { invoiceStatusAfterPayment } from "@/lib/pm/invoice-status";

export async function recomputeInvoiceStatus(
  admin: PmDb,
  invoiceId: string,
): Promise<{
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

/**
 * Reversing a rent payment must also unwind the landlord's 1% fee row, otherwise the
 * owner is still paid 99% of rent that was taken back.
 *
 * If the fee has not been batched yet we simply mark it reversed so no payout picks it up.
 * If it has already been sent, the cash is gone and only a human can claw it back — so we
 * page ops rather than pretending the books are square.
 */
async function reverseePlatformFee(admin: PmDb, rentPaymentId: string): Promise<void> {
  const { data: fee } = await admin
    .from("pm_platform_fee_ledger")
    .select("id, owner_user_id, net_payout_amount, payout_batch_id, reversed_at")
    .eq("rent_payment_id", rentPaymentId)
    .maybeSingle();

  if (!fee || fee.reversed_at) return;

  // Only cancel while still unbatched — the filter makes this a compare-and-set against a
  // payout run that may be claiming the same row right now.
  const { data: cancelled } = await admin
    .from("pm_platform_fee_ledger")
    .update({ reversed_at: new Date().toISOString() })
    .eq("id", fee.id)
    .is("payout_batch_id", null)
    .select("id");

  if (cancelled?.length) return;

  console.error("[pm] reversed rent was already paid out — manual clawback required", {
    rentPaymentId,
    feeId: fee.id,
    ownerUserId: fee.owner_user_id,
  });

  try {
    const { OPS_EMAIL } = await import("@/lib/api/notify");
    const { sendEmail } = await import("@/lib/email/send");
    await sendEmail({
      to: OPS_EMAIL,
      templateId: "ops-payout-clawback",
      subject: `Clawback needed — reversed rent ${rentPaymentId.slice(0, 8)} was already paid out`,
      text: `A rent payment was reversed after its payout had already been sent.\n\nRent payment: ${rentPaymentId}\nFee ledger row: ${fee.id}\nOwner: ${fee.owner_user_id}\nNet already paid: KES ${Number(fee.net_payout_amount)}\nPayout batch: ${fee.payout_batch_id}\n\nRecover this amount from the landlord (offset against their next payout).`,
      html: `<p>A rent payment was reversed after its payout had already been sent.</p><p>Rent payment <code>${rentPaymentId}</code> · Fee row <code>${fee.id}</code> · Owner <code>${fee.owner_user_id}</code></p><p>Net already paid: <strong>KES ${Number(fee.net_payout_amount)}</strong> in batch <code>${fee.payout_batch_id}</code>.</p><p>Recover this amount from the landlord (offset against their next payout).</p>`,
    });
  } catch (e) {
    console.warn("[pm] ops clawback email failed:", e);
  }
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

  await reverseePlatformFee(admin, opts.originalPaymentId);

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
