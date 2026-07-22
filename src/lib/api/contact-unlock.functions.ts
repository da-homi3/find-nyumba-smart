import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { isKenyanPhone } from "@/lib/phone";
import { unlockFeeForRent } from "@/lib/payments/unlock-pricing";
import { ensureTenantTrial } from "@/lib/payments/tenant-trial";
import { getTenantPlusStatus } from "@/lib/revenue/subscription-store";
import { initiatePaymentCore } from "@/lib/payments/initiate-payment-core";
import { notifyContactUnlockEmails } from "@/lib/email/contact-unlock-notify";
import { phonesFromProperty } from "@/lib/contact-phones";

async function resolveContactPhones(
  admin: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >,
  listingId: string,
): Promise<string[]> {
  const { data: property } = await admin
    .from("properties")
    .select("contact_phone, contact_phones, owner_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!property) return [];

  const listingPhones = phonesFromProperty(property);
  if (listingPhones.length > 0) return listingPhones;

  if (!property.owner_id) return [];
  const { data: profile } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", property.owner_id)
    .maybeSingle();
  const fallback = profile?.phone?.trim();
  return fallback ? [fallback] : [];
}

export const getListingUnlockState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: unlock }, plus, trial] = await Promise.all([
      supabaseAdmin
        .from("contact_unlocks")
        .select("id, method")
        .eq("user_id", userId)
        .eq("listing_id", data.listingId)
        .maybeSingle(),
      getTenantPlusStatus(supabaseAdmin, userId),
      ensureTenantTrial(supabaseAdmin, userId),
    ]);

    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("rent_kes")
      .eq("id", data.listingId)
      .maybeSingle();

    const rent = property?.rent_kes ?? 0;
    const fee = unlockFeeForRent(rent);
    const isPlus = plus.tenantPlan === "plus";

    let contactPhones: string[] = [];
    if (unlock || isPlus) {
      contactPhones = await resolveContactPhones(supabaseAdmin, data.listingId);
    }
    const contactPhone = contactPhones[0] ?? null;

    const { data: spendRows } = await supabaseAdmin
      .from("contact_unlocks")
      .select("fee_charged")
      .eq("user_id", userId)
      .eq("method", "paid")
      .gte(
        "unlocked_at",
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      );

    const monthlyUnlockSpend = (spendRows ?? []).reduce(
      (sum, row) => sum + (row.fee_charged ?? 0),
      0,
    );

    return {
      unlocked: Boolean(unlock) || isPlus,
      method: unlock?.method ?? (isPlus ? "plus" : null),
      contactPhone,
      contactPhones,
      fee,
      isPlus,
      trialUnlocksRemaining: trial.trialUnlocksRemaining,
      trialActive: trial.trialActive,
      trialEndsAt: trial.trialEndsAt,
      monthlyUnlockSpend,
    };
  });

const NO_CONTACT = {
  unlocked: false as const,
  error: "no_contact" as const,
  message: "Phone number is not available for this listing yet.",
};

type UnlockAdmin = import("@supabase/supabase-js").SupabaseClient<
  import("@/integrations/supabase/types").Database
>;

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
  };
}

export const unlockListingContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      listingId: z.string().uuid(),
      method: z.enum(["mpesa", "card"]).optional(),
      phoneNumber: z.string().optional(),
      email: z.string().email().optional(),
      idempotencyKey: z.string().min(8).max(64).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("contact_unlocks")
      .select("id, method")
      .eq("user_id", userId)
      .eq("listing_id", data.listingId)
      .maybeSingle();

    const contactPhones = await resolveContactPhones(supabaseAdmin, data.listingId);
    const contactPhone = contactPhones[0] ?? null;

    if (existing) {
      return {
        unlocked: true as const,
        contactPhone,
        contactPhones,
        method: "already_unlocked" as const,
      };
    }

    const plus = await getTenantPlusStatus(supabaseAdmin, userId);
    if (plus.tenantPlan === "plus") {
      if (!contactPhone) return NO_CONTACT;
      return unlockWithPlus(supabaseAdmin, userId, data.listingId, contactPhone, contactPhones);
    }

    const trial = await ensureTenantTrial(supabaseAdmin, userId);
    if (trial.trialActive && trial.trialUnlocksRemaining > 0) {
      if (!contactPhone) return NO_CONTACT;
      return unlockWithTrial(
        supabaseAdmin,
        userId,
        data.listingId,
        contactPhone,
        contactPhones,
        trial.trialUnlocksRemaining,
      );
    }

    if (!contactPhone) return NO_CONTACT;

    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("rent_kes")
      .eq("id", data.listingId)
      .maybeSingle();
    const fee = unlockFeeForRent(property?.rent_kes ?? 0);

    if (!data.method) {
      return {
        unlocked: false as const,
        status: "payment_required" as const,
        fee,
        paymentType: "contact_unlock" as const,
      };
    }

    return unlockWithPayment(supabaseAdmin, userId, { ...data, method: data.method }, contactPhones, fee);
  });
