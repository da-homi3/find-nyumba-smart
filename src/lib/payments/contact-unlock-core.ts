/**
 * Contact-unlock business cores shared by TanStack server fns and Mobile BFF.
 * Do not duplicate unlock/payment branching elsewhere.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isKenyanPhone } from "@/lib/phone";
import { unlockFeeForRent } from "@/lib/payments/unlock-pricing";
import { ensureTenantTrial } from "@/lib/payments/tenant-trial";
import { getTenantPlusStatus } from "@/lib/revenue/subscription-store";
import { initiatePaymentCore } from "@/lib/payments/initiate-payment-core";
import { notifyContactUnlockEmails } from "@/lib/email/contact-unlock-notify";
import { phonesFromProperty } from "@/lib/contact-phones";

export type UnlockAdmin = SupabaseClient<Database>;

export const NO_CONTACT = {
  unlocked: false as const,
  error: "no_contact" as const,
  message: "Phone number is not available for this listing yet.",
};

export async function resolveContactPhones(
  admin: UnlockAdmin,
  listingId: string,
): Promise<string[]> {
  const { data: property } = await admin
    .from("properties")
    .select("contact_phone, contact_phones, owner_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!property) return [];

  const listingPhones = phonesFromProperty(property);
  if (listingPhones.length > 0) {
    const { filterTrustedContactPhones } = await import("@/lib/apilayer/verify");
    return filterTrustedContactPhones(listingPhones);
  }

  if (!property.owner_id) return [];
  const { data: profile } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", property.owner_id)
    .maybeSingle();
  const fallback = profile?.phone?.trim();
  if (!fallback) return [];
  const { filterTrustedContactPhones } = await import("@/lib/apilayer/verify");
  return filterTrustedContactPhones([fallback]);
}

export async function getListingUnlockStateCore(
  admin: UnlockAdmin,
  userId: string,
  listingId: string,
) {
  const [{ data: unlock }, plus, trial] = await Promise.all([
    admin
      .from("contact_unlocks")
      .select("id, method")
      .eq("user_id", userId)
      .eq("listing_id", listingId)
      .maybeSingle(),
    getTenantPlusStatus(admin, userId),
    ensureTenantTrial(admin, userId),
  ]);

  const { data: property } = await admin
    .from("properties")
    .select("rent_kes")
    .eq("id", listingId)
    .maybeSingle();

  const rent = property?.rent_kes ?? 0;
  const fee = unlockFeeForRent(rent);
  const isPlus = plus.tenantPlan === "plus";
  const { TENANT_PLUS_CONFIG, contactCreditsForFee } = await import(
    "@/lib/revenue/tenant-plus-config"
  );
  const { getPlusContactCredits } = await import("@/lib/revenue/plus-contact-credits");
  const plusContactCredits = isPlus ? await getPlusContactCredits(admin, userId) : 0;
  const creditsRequired = contactCreditsForFee(fee);
  const plusCanCover = isPlus && TENANT_PLUS_CONFIG.flags.contactCreditsEnabled
    ? plusContactCredits >= creditsRequired
    : isPlus && !TENANT_PLUS_CONFIG.flags.contactCreditsEnabled;

  let contactPhones: string[] = [];
  if (unlock) {
    contactPhones = await resolveContactPhones(admin, listingId);
  }
  const contactPhone = contactPhones[0] ?? null;

  const { data: spendRows } = await admin
    .from("contact_unlocks")
    .select("fee_charged")
    .eq("user_id", userId)
    .eq("method", "paid")
    .gte("unlocked_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

  const monthlyUnlockSpend = (spendRows ?? []).reduce(
    (sum, row) => sum + (row.fee_charged ?? 0),
    0,
  );

  return {
    unlocked: Boolean(unlock),
    method: unlock?.method ?? null,
    contactPhone,
    contactPhones,
    fee,
    isPlus,
    trialUnlocksRemaining: trial.trialUnlocksRemaining,
    trialActive: trial.trialActive,
    trialEndsAt: trial.trialEndsAt,
    monthlyUnlockSpend,
    plusContactCredits,
    creditsRequired,
    plusCanCover,
  };
}

async function unlockWithPlus(
  admin: UnlockAdmin,
  userId: string,
  listingId: string,
  contactPhone: string,
  contactPhones: string[],
) {
  await admin.from("contact_unlocks").insert({
    user_id: userId,
    listing_id: listingId,
    method: "plus",
    fee_charged: 0,
  });
  void notifyContactUnlockEmails(admin, {
    userId,
    listingId,
    method: "plus",
    feeKes: 0,
  });
  return { unlocked: true as const, contactPhone, contactPhones, method: "plus" as const };
}

async function unlockWithTrial(
  admin: UnlockAdmin,
  userId: string,
  listingId: string,
  contactPhone: string,
  contactPhones: string[],
  remaining: number,
) {
  const { data: decremented, error: decErr } = await admin
    .from("profiles")
    .update({ trial_unlocks_remaining: remaining - 1 })
    .eq("id", userId)
    .gt("trial_unlocks_remaining", 0)
    .select("trial_unlocks_remaining")
    .maybeSingle();

  if (decErr || !decremented) {
    throw new Error("Free unlock could not be applied. Please try again.");
  }

  const { error: unlockInsertErr } = await admin.from("contact_unlocks").insert({
    user_id: userId,
    listing_id: listingId,
    method: "trial",
    fee_charged: 0,
  });

  if (unlockInsertErr) {
    await admin.from("profiles").update({ trial_unlocks_remaining: remaining }).eq("id", userId);
    throw new Error("Free unlock could not be applied. Please try again.");
  }

  void notifyContactUnlockEmails(admin, {
    userId,
    listingId,
    method: "trial",
    feeKes: 0,
  });

  return {
    unlocked: true as const,
    contactPhone,
    contactPhones,
    method: "trial" as const,
    trialUnlocksRemaining: decremented.trial_unlocks_remaining,
  };
}

async function unlockWithPayment(
  admin: UnlockAdmin,
  userId: string,
  data: {
    listingId: string;
    method: "mpesa" | "card";
    phoneNumber?: string;
    email?: string;
    idempotencyKey?: string;
  },
  contactPhones: string[],
  fee: number,
) {
  if (data.method === "mpesa" && (!data.phoneNumber || !isKenyanPhone(data.phoneNumber))) {
    throw new Error("Enter a valid M-Pesa phone number");
  }

  const { assertCleanEmail, assertCleanKenyanMobile } = await import("@/lib/apilayer/verify");
  if (data.method === "mpesa" && data.phoneNumber) {
    await assertCleanKenyanMobile(data.phoneNumber, "unlock");
  }
  if (data.email?.trim()) {
    await assertCleanEmail(data.email.trim(), "unlock");
  }

  const idempotencyKey =
    data.idempotencyKey ?? `unlock-${data.listingId}-${userId.slice(0, 8)}-${Date.now()}`;
  const paymentRes = await initiatePaymentCore(userId, {
    propertyId: data.listingId,
    amountKes: fee,
    paymentType: "contact_unlock",
    phoneNumber: data.phoneNumber ?? "",
    paymentMethod: data.method,
    idempotencyKey,
    email: data.email,
    plan: `unlock-${data.listingId}`,
    successPath: `/tenant/property/${data.listingId}`,
    cancelPath: `/tenant/property/${data.listingId}`,
    title: "Contact unlock",
  });

  if (paymentRes.status === "completed") {
    const phones = await resolveContactPhones(admin, data.listingId);
    await admin.from("contact_unlocks").upsert(
      {
        user_id: userId,
        listing_id: data.listingId,
        method: "paid",
        fee_charged: fee,
      },
      { onConflict: "user_id,listing_id" },
    );
    void notifyContactUnlockEmails(admin, {
      userId,
      listingId: data.listingId,
      method: "paid",
      feeKes: fee,
    });
    return {
      unlocked: true as const,
      contactPhone: phones[0] ?? null,
      contactPhones: phones,
      method: "paid" as const,
    };
  }

  return {
    unlocked: false as const,
    status: paymentRes.status,
    paymentId: paymentRes.paymentId,
    fee,
    message: "message" in paymentRes ? paymentRes.message : undefined,
    redirectUrl:
      "redirectUrl" in paymentRes && typeof paymentRes.redirectUrl === "string"
        ? paymentRes.redirectUrl
        : undefined,
  };
}

export type UnlockListingInput = {
  listingId: string;
  method?: "mpesa" | "card";
  phoneNumber?: string;
  email?: string;
  idempotencyKey?: string;
};

export async function unlockListingContactCore(
  admin: UnlockAdmin,
  userId: string,
  data: UnlockListingInput,
) {
  const { data: existing } = await admin
    .from("contact_unlocks")
    .select("id, method")
    .eq("user_id", userId)
    .eq("listing_id", data.listingId)
    .maybeSingle();

  const contactPhones = await resolveContactPhones(admin, data.listingId);
  const contactPhone = contactPhones[0] ?? null;

  if (existing) {
    return {
      unlocked: true as const,
      contactPhone,
      contactPhones,
      method: "already_unlocked" as const,
    };
  }

  const plus = await getTenantPlusStatus(admin, userId);
  const { data: property } = await admin
    .from("properties")
    .select("rent_kes")
    .eq("id", data.listingId)
    .maybeSingle();
  const fee = unlockFeeForRent(property?.rent_kes ?? 0);

  if (plus.tenantPlan === "plus") {
    const { TENANT_PLUS_CONFIG, contactCreditsForFee } = await import(
      "@/lib/revenue/tenant-plus-config"
    );
    if (!TENANT_PLUS_CONFIG.flags.contactCreditsEnabled) {
      if (!contactPhone) return NO_CONTACT;
      return unlockWithPlus(admin, userId, data.listingId, contactPhone, contactPhones);
    }
    const cost = contactCreditsForFee(fee);
    const { consumePlusContactCredits, getPlusContactCredits } = await import(
      "@/lib/revenue/plus-contact-credits"
    );
    const remaining = await getPlusContactCredits(admin, userId);
    if (remaining >= cost) {
      if (!contactPhone) return NO_CONTACT;
      const consumed = await consumePlusContactCredits(admin, userId, cost);
      if (consumed.ok) {
        const result = await unlockWithPlus(
          admin,
          userId,
          data.listingId,
          contactPhone,
          contactPhones,
        );
        return { ...result, plusContactCredits: consumed.remaining, creditsUsed: cost };
      }
    }
    if (!data.method) {
      return {
        unlocked: false as const,
        status: "payment_required" as const,
        fee,
        paymentType: "contact_unlock" as const,
        plusContactCredits: remaining,
        creditsRequired: cost,
        message:
          remaining < cost
            ? "You've used your included contact credits. Pay once for this listing or buy more by renewing Plus."
            : undefined,
      };
    }
  } else {
    const trial = await ensureTenantTrial(admin, userId);
    if (trial.trialActive && trial.trialUnlocksRemaining > 0) {
      if (!contactPhone) return NO_CONTACT;
      return unlockWithTrial(
        admin,
        userId,
        data.listingId,
        contactPhone,
        contactPhones,
        trial.trialUnlocksRemaining,
      );
    }
  }

  if (!contactPhone) return NO_CONTACT;

  if (!data.method) {
    return {
      unlocked: false as const,
      status: "payment_required" as const,
      fee,
      paymentType: "contact_unlock" as const,
    };
  }

  return unlockWithPayment(admin, userId, { ...data, method: data.method }, contactPhones, fee);
}

export async function verifyPaymentStatusCore(
  admin: UnlockAdmin,
  userId: string,
  paymentId: string,
) {
  const { data: row, error } = await admin
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;

  const ageMs = Date.now() - new Date(row.created_at).getTime();
  let synced = row;
  if (row.status === "pending" && ageMs > 2_000) {
    if (row.payment_method === "mpesa") {
      synced = await (
        await import("@/lib/payments/complete-mpesa-payment")
      ).syncMpesaPaymentStatus(admin, row);
    } else if (row.payment_method === "card") {
      synced = await (
        await import("@/lib/payments/complete-pesapal-payment")
      ).syncPesapalPaymentStatus(admin, row);
    }
  }

  let message = "Waiting for payment confirmation";
  if (synced.payment_method === "mpesa" && synced.status === "pending") {
    message = "Waiting for M-Pesa confirmation";
  } else if (synced.payment_method === "card" && synced.status === "pending") {
    message = "Waiting for card payment confirmation";
  }
  if (synced.status === "completed") message = "Payment confirmed";
  else if (synced.status === "failed") message = "Payment failed or was cancelled";

  return {
    status: synced.status,
    paymentId: synced.id,
    method: synced.payment_method,
    purpose: synced.payment_type,
    receipt: synced.mpesa_receipt ?? undefined,
    message,
  };
}
