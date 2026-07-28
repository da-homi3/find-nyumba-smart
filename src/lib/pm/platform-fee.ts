/** 1% platform fee on credited rent — recorded at collection/confirm time. */

export const PLATFORM_FEE_RATE = 0.01;

export function calculatePlatformFee(grossAmount: number): {
  platformFee: number;
  netPayoutAmount: number;
} {
  const gross = Math.max(0, Math.round(grossAmount));
  const platformFee = Math.round(gross * PLATFORM_FEE_RATE);
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
  admin: { from: (t: string) => any },
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
