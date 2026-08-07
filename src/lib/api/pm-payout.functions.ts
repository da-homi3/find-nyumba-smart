import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { adminClient, authContext } from "@/lib/api/nyumba/nyumba-shared";
import { sendEmail } from "@/lib/email/send";
import { asPmDb, assertPmPropertyAccess } from "@/lib/pm/access";
import { fetchIntasendBankCodes, resolveBankAccountName } from "@/lib/pm/intasend-payout";
import { KENYA_BANKS, namesRoughlyMatch } from "@/lib/pm/payout-destinations";
import { storePayoutPhoneOtp, verifyPayoutPhoneOtp } from "@/lib/pm/payout-otp-store";
import { processPayoutBatch } from "@/lib/pm/payout-batch";
import { toMpesaPhone254 } from "@/lib/phone";

const PORTAL_ROLES = ["landlord", "agency", "manager"] as const;

const destinationTypeSchema = z.enum([
  "mpesa_paybill",
  "mpesa_till",
  "mpesa_phone",
  "bank_account",
]);

type CreateDestinationInput = {
  destinationType: z.infer<typeof destinationTypeSchema>;
  propertyId?: string | null;
  mpesaPaybillNumber?: string | null;
  mpesaAccountNumber?: string | null;
  mpesaTillNumber?: string | null;
  mpesaPhone?: string | null;
  bankName?: string | null;
  bankCode?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  otpVerified?: boolean;
};

type DestinationVerification = {
  verified: boolean;
  resolvedName?: string;
  warning?: string;
  phone254: string | null;
};

async function verifyDestination(input: CreateDestinationInput): Promise<DestinationVerification> {
  switch (input.destinationType) {
    case "bank_account":
      return verifyBankDestination(input);
    case "mpesa_paybill":
      return verifyMpesaPaybillDestination(input);
    case "mpesa_phone":
      return verifyMpesaPhoneDestination(input);
    case "mpesa_till":
      return verifyMpesaTillDestination(input);
    default:
      return { verified: false, phone254: null };
  }
}

async function verifyBankDestination(
  input: CreateDestinationInput,
): Promise<DestinationVerification> {
  if (!input.bankCode || !input.bankAccountNumber || !input.bankAccountName) {
    throw new Error("Bank code, account number, and account name are required");
  }
  const resolved = await resolveBankAccountName({
    accountNumber: input.bankAccountNumber,
    bankCode: input.bankCode,
  });
  if (!resolved.ok) {
    return { verified: false, warning: resolved.message, phone254: null };
  }

  const verified = namesRoughlyMatch(resolved.accountName, input.bankAccountName);
  return {
    verified,
    resolvedName: resolved.accountName,
    warning: verified
      ? undefined
      : `Bank records show "${resolved.accountName}" — that does not match what you typed. Destination saved but not verified.`,
    phone254: null,
  };
}

function verifyMpesaPaybillDestination(input: CreateDestinationInput): DestinationVerification {
  if (!input.mpesaPaybillNumber || !input.mpesaAccountNumber) {
    throw new Error("Paybill number and account number are required");
  }
  return {
    verified: true,
    phone254: null,
  };
}

function verifyMpesaPhoneDestination(input: CreateDestinationInput): DestinationVerification {
  const phone254 = toMpesaPhone254(input.mpesaPhone ?? "");
  if (!phone254) throw new Error("Enter a valid Safaricom phone number");
  if (!input.otpVerified) {
    throw new Error("Confirm the OTP sent for this M-Pesa number before saving");
  }
  return {
    verified: true,
    phone254,
  };
}

function verifyMpesaTillDestination(input: CreateDestinationInput): DestinationVerification {
  if (!input.mpesaTillNumber) throw new Error("Till number is required");
  return {
    verified: true,
    phone254: null,
  };
}

export const listKenyaBanks = createServerFn({ method: "GET" }).handler(async () => {
  const live = await fetchIntasendBankCodes();
  if (live.length > 0) {
    return live.map((b) => ({ code: String(b.bank_code), name: b.bank_name }));
  }
  return [...KENYA_BANKS];
});

export const listPayoutDestinations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);
    const admin = asPmDb(await adminClient());

    const { data, error } = await admin
      .from("pm_payout_destinations")
      .select("*")
      .eq("owner_user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const listPayoutBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);
    const admin = asPmDb(await adminClient());

    const { data, error } = await admin
      .from("pm_payout_batches")
      .select("*")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });

export const createPayoutDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      destinationType: destinationTypeSchema,
      propertyId: z.string().uuid().optional().nullable(),
      mpesaPaybillNumber: z.string().trim().max(20).optional().nullable(),
      mpesaAccountNumber: z.string().trim().max(40).optional().nullable(),
      mpesaTillNumber: z.string().trim().max(20).optional().nullable(),
      mpesaPhone: z.string().trim().max(20).optional().nullable(),
      bankName: z.string().trim().max(80).optional().nullable(),
      bankCode: z.string().trim().max(20).optional().nullable(),
      bankAccountNumber: z.string().trim().max(40).optional().nullable(),
      bankAccountName: z.string().trim().max(120).optional().nullable(),
      /** For M-Pesa phone: OTP already verified client-side via confirmPayoutPhoneOtp */
      otpVerified: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);
    const admin = asPmDb(await adminClient());

    if (data.propertyId) {
      await assertPmPropertyAccess(admin, userId, data.propertyId);
    }

    const { verified, resolvedName, warning, phone254 } = await verifyDestination(data);

    const { data: row, error } = await admin
      .from("pm_payout_destinations")
      .insert({
        owner_user_id: userId,
        property_id: data.propertyId ?? null,
        destination_type: data.destinationType,
        mpesa_paybill_number: data.mpesaPaybillNumber ?? null,
        mpesa_account_number: data.mpesaAccountNumber ?? null,
        mpesa_till_number: data.mpesaTillNumber ?? null,
        mpesa_phone: phone254,
        bank_name: data.bankName ?? null,
        bank_code: data.bankCode ?? null,
        bank_account_number: data.bankAccountNumber ?? null,
        bank_account_name: data.bankAccountName ?? null,
        verified,
        is_active: true,
      })
      .select("*")
      .single();
    if (error) throw error;

    return { destination: row, verified, resolvedName, warning };
  });

export const sendPayoutPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ phone: z.string().trim().min(9).max(20) }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);

    const phone254 = toMpesaPhone254(data.phone);
    if (!phone254) throw new Error("Invalid Safaricom phone number");

    const code = await storePayoutPhoneOtp({ userId, phone: phone254 });

    // No SMS gateway yet — email the OTP to the signed-in landlord as proof of intent.
    // When B2C goes live, swap to SMS to the destination number.
    const admin = await adminClient();
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    const email = userData.user?.email;
    if (email) {
      await sendEmail({
        to: email,
        templateId: "payout_phone_otp",
        subject: "Confirm your rent payout M-Pesa number",
        text: `Your NyumbaSearch payout confirmation code is ${code}. It expires in 15 minutes.\n\nNumber: ${phone254}`,
        html: `<p>Your confirmation code for M-Pesa payout number <strong>${phone254}</strong> is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>Expires in 15 minutes.</p>`,
      });
    }

    return { sent: true as const, phone: phone254 };
  });

export const confirmPayoutPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      phone: z.string().trim().min(9).max(20),
      code: z.string().trim().length(6),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);
    const phone254 = toMpesaPhone254(data.phone);
    if (!phone254) throw new Error("Invalid phone");
    const ok = await verifyPayoutPhoneOtp({ userId, phone: phone254, code: data.code });
    if (!ok) throw new Error("Invalid or expired code");
    return { verified: true as const, phone: phone254 };
  });

export const deactivatePayoutDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ destinationId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);
    const admin = asPmDb(await adminClient());

    const { error } = await admin
      .from("pm_payout_destinations")
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq("id", data.destinationId)
      .eq("owner_user_id", userId);
    if (error) throw error;
    return { success: true as const };
  });

export const getAdminPlatformFeeSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = asPmDb(await adminClient());

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data: fees } = await admin
      .from("pm_platform_fee_ledger")
      .select("platform_fee")
      .gte("created_at", monthStart.toISOString());

    const monthToDatePlatformFeeRevenue = (fees ?? []).reduce(
      (s: number, r: { platform_fee: number }) => s + Number(r.platform_fee),
      0,
    );

    const { data: failedBatches } = await admin
      .from("pm_payout_batches")
      .select("*")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(50);

    return {
      monthToDatePlatformFeeRevenue,
      monthToDateTransactionCount: fees?.length ?? 0,
      failedPayoutBatches: failedBatches ?? [],
    };
  });

export const retryPayoutBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ batchId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = asPmDb(await adminClient());
    const status = await processPayoutBatch(admin, data.batchId);
    return { success: true as const, status };
  });
