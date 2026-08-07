import type { LooseDb } from "@/lib/db/loose-client";

export type FeeAndPayoutInput = {
  rentPaymentId: string;
  ownerUserId: string;
  propertyId: string;
  grossAmount: number;
};

/**
 * Records the 1% platform fee for a credited rent payment and kicks off the instant payout.
 *
 * Called after the `pm_rent_payments` row already exists, so it must never throw — throwing
 * here would fail the caller after the tenant's money was credited. Instead, a failure is
 * escalated to ops: the fee ledger is what drives landlord payouts, so a missing row is real
 * money owed. `recordPlatformFee` is idempotent per rent payment, so retrying is safe.
 */
export async function recordFeeAndDisburse(
  admin: LooseDb,
  input: FeeAndPayoutInput,
): Promise<void> {
  try {
    const { recordPlatformFee } = await import("@/lib/pm/platform-fee");
    await recordPlatformFee(admin, input);
  } catch (err) {
    console.error("[pm] platform fee record FAILED — landlord payout is owed", input, err);
    await alertOpsFeeLedgerGap(input, err);
    return;
  }

  try {
    const { disburseUnbatchedFeeNow } = await import("@/lib/pm/payout-batch");
    await disburseUnbatchedFeeNow(admin, {
      rentPaymentId: input.rentPaymentId,
      ownerUserId: input.ownerUserId,
      propertyId: input.propertyId,
    });
  } catch (err) {
    // The fee row exists, so the daily payout cron will pick this up. Log only.
    console.warn("[pm] instant payout failed, deferring to payout cron:", err);
  }
}

async function alertOpsFeeLedgerGap(input: FeeAndPayoutInput, err: unknown): Promise<void> {
  try {
    const { OPS_EMAIL } = await import("@/lib/api/notify");
    const { sendEmail } = await import("@/lib/email/send");
    const message = err instanceof Error ? err.message : String(err);
    await sendEmail({
      to: OPS_EMAIL,
      templateId: "ops-fee-ledger-gap",
      subject: `Platform fee not recorded for rent payment ${input.rentPaymentId.slice(0, 8)}`,
      text: `Rent of KES ${input.grossAmount} was credited but the platform fee ledger row could not be written, so no payout will be generated.\n\n${message}\n\nRent payment: ${input.rentPaymentId}\nOwner: ${input.ownerUserId}\nProperty: ${input.propertyId}\n\nRe-run the fee record for this payment (it is idempotent) so the landlord gets paid.`,
      html: `<p>Rent of <strong>KES ${input.grossAmount}</strong> was credited but the platform fee ledger row could not be written, so no payout will be generated.</p><p>${message}</p><p>Rent payment <code>${input.rentPaymentId}</code> · Owner <code>${input.ownerUserId}</code> · Property <code>${input.propertyId}</code></p><p>Re-run the fee record for this payment (it is idempotent) so the landlord gets paid.</p>`,
    });
  } catch (e) {
    console.warn("[pm] ops fee-ledger-gap email failed:", e);
  }
}
