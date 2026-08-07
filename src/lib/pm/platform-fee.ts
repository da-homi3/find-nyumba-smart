/** 1% platform fee on credited rent — recorded at collection/confirm time. */
import type { LooseDb } from "@/lib/db/loose-client";

export const PLATFORM_FEE_RATE = 0.01;

/**
 * Whole-KES fee: round 1% of gross. For small amounts where 1% rounds to 0,
 * charge at least KES 1 so the platform fee is never skipped on a real payment.
 * Example: KES 19 → fee 1, net 18 (≈1% in whole shillings).
 */
export function calculatePlatformFee(grossAmount: number): {
  platformFee: number;
  netPayoutAmount: number;
} {
  const gross = Math.max(0, Math.round(grossAmount));
  if (gross <= 0) return { platformFee: 0, netPayoutAmount: 0 };
  const rounded = Math.round(gross * PLATFORM_FEE_RATE);
  const platformFee = Math.min(gross, Math.max(1, rounded));
  return {
    platformFee,
    netPayoutAmount: Math.max(0, gross - platformFee),
  };
}

export type RecordPlatformFeeInput = {
  rentPaymentId: string;
  ownerUserId: string;
  propertyId: string;
  grossAmount: number;
};

/**
 * Inserts exactly one fee ledger row per rent payment (idempotent on rent_payment_id).
 * Call after every credited pm_rent_payments INSERT (M-Pesa, manual, claim confirm).
 */
export async function recordPlatformFee(
  admin: LooseDb,
  input: RecordPlatformFeeInput,
): Promise<{ platformFee: number; netPayoutAmount: number } | null> {
  const gross = Math.round(input.grossAmount);
  if (gross <= 0) return null;

  const { platformFee, netPayoutAmount } = calculatePlatformFee(gross);

  const { error } = await admin.from("pm_platform_fee_ledger").insert({
    rent_payment_id: input.rentPaymentId,
    owner_user_id: input.ownerUserId,
    property_id: input.propertyId,
    gross_amount: gross,
    platform_fee: platformFee,
    net_payout_amount: netPayoutAmount,
  });

  if (error) {
    if (/duplicate|unique/i.test(error.message ?? "")) {
      return { platformFee, netPayoutAmount };
    }
    throw error;
  }

  return { platformFee, netPayoutAmount };
}
