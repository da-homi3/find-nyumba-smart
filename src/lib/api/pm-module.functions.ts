import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { adminClient, authContext } from "@/lib/api/nyumba/nyumba-shared";
import { asPmDb, assertPmPropertyAccess, assertStaffCan } from "@/lib/pm/access";
import { recordFeeAndDisburse } from "@/lib/pm/fee-and-payout";
import { createPaymentReversal, recomputeInvoiceStatus } from "@/lib/pm/invoice-integrity";
import {
  activatePmModuleForAccount,
  getActivePmSubscription,
  isFirstTimeSubscriberForModule,
  userHasPmModuleAccess,
} from "@/lib/pm/module-gate";
import { recommendedPmTier } from "@/lib/pm/pricing";
import { addDaysFromNow } from "@/lib/payments/trial-eligibility";

const PORTAL_ROLES = ["landlord", "agency", "manager"] as const;

async function propertyIdForInvoice(admin: ReturnType<typeof asPmDb>, invoiceId: string) {
  const { data: invoice } = await admin
    .from("pm_rent_invoices")
    .select("lease_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return null;
  const { data: lease } = await admin
    .from("pm_leases")
    .select("unit_id")
    .eq("id", invoice.lease_id)
    .maybeSingle();
  if (!lease) return null;
  const { data: unit } = await admin
    .from("pm_units")
    .select("property_id")
    .eq("id", lease.unit_id)
    .maybeSingle();
  return unit?.property_id as string | null;
}

export const getPmModuleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);
    const admin = asPmDb(await adminClient());

    const recommended = await recommendedPmTier(admin, userId);
    const sub = await getActivePmSubscription(admin, userId);
    const active = await userHasPmModuleAccess(admin, userId);

    return {
      active,
      subscription: sub
        ? {
            id: sub.id,
            plan: sub.plan,
            status: sub.status,
            amountKes: sub.amount_kes,
            trialEnd: sub.trial_end,
            nextBillingDate: sub.next_billing_date,
          }
        : null,
      recommendedTier: recommended.tier,
      recommendedTierName: recommended.tierName,
      recommendedPriceKes: recommended.priceKes,
      unitCount: recommended.unitCount,
    };
  });

export const subscribePropertyManagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);
    const admin = asPmDb(await adminClient());

    const existing = await getActivePmSubscription(admin, userId);
    if (existing) {
      return {
        status: "already_active" as const,
        tier: existing.plan,
        priceKes: existing.amount_kes,
      };
    }

    const { tier, priceKes } = await recommendedPmTier(admin, userId);
    const isFirstTime = await isFirstTimeSubscriberForModule(admin, userId, "property_management");

    if (isFirstTime) {
      const trialEnd = addDaysFromNow(30);
      const { data: sub, error } = await admin
        .from("subscriptions")
        .insert({
          user_id: userId,
          plan: tier,
          module: "property_management",
          status: "trialing",
          amount_kes: priceKes,
          billing_cycle: "monthly",
          payment_method: "mpesa",
          next_billing_date: trialEnd,
          trial_end: trialEnd,
        })
        .select("id")
        .single();
      if (error) throw error;

      await activatePmModuleForAccount(admin, userId);

      return {
        status: "trial_started" as const,
        subscriptionId: sub.id,
        tier,
        priceKes,
        trialEnd,
      };
    }

    return {
      status: "requires_payment" as const,
      tier,
      priceKes,
    };
  });

export const listPmPaymentClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyId: z.string().uuid(),
      status: z.enum(["pending", "confirmed", "disputed", "withdrawn"]).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);
    const admin = asPmDb(await adminClient());
    await assertPmPropertyAccess(admin, userId, data.propertyId);

    const { data: units } = await admin
      .from("pm_units")
      .select("id")
      .eq("property_id", data.propertyId)
      .is("deleted_at", null);
    const unitIds = (units ?? []).map((u: { id: string }) => u.id);
    if (unitIds.length === 0) return [];

    const { data: leases } = await admin.from("pm_leases").select("id").in("unit_id", unitIds);
    const leaseIds = (leases ?? []).map((l: { id: string }) => l.id);
    if (leaseIds.length === 0) return [];

    const { data: invoices } = await admin
      .from("pm_rent_invoices")
      .select("id")
      .in("lease_id", leaseIds);
    const invoiceIds = (invoices ?? []).map((i: { id: string }) => i.id);
    if (invoiceIds.length === 0) return [];

    let query = admin
      .from("pm_rent_payment_claims")
      .select("*")
      .in("invoice_id", invoiceIds)
      .order("submitted_at", { ascending: false });
    if (data.status) query = query.eq("status", data.status);

    const { data: claims, error } = await query.limit(100);
    if (error) throw error;
    return claims ?? [];
  });

export const confirmPmPaymentClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ claimId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);
    const admin = asPmDb(await adminClient());

    const { data: claim } = await admin
      .from("pm_rent_payment_claims")
      .select("*")
      .eq("id", data.claimId)
      .maybeSingle();
    if (!claim) throw new Error("Claim not found");

    const propertyId = await propertyIdForInvoice(admin, claim.invoice_id as string);
    if (!propertyId) throw new Error("Invoice not found");
    const { staffRole } = await assertPmPropertyAccess(admin, userId, propertyId);
    assertStaffCan(staffRole, "payments:create");

    if (claim.status !== "pending") {
      throw new Error(`Claim is already ${claim.status}`);
    }

    const { data: property } = await admin
      .from("pm_properties")
      .select("id, owner_user_id")
      .eq("id", propertyId)
      .maybeSingle();
    if (!property) throw new Error("Property not found");

    // Claim the row before crediting anything. Filtering on the still-pending status makes
    // this a compare-and-set, so two concurrent confirms can't both insert a rent payment.
    const { data: confirmed } = await admin
      .from("pm_rent_payment_claims")
      .update({
        status: "confirmed",
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: userId,
      })
      .eq("id", claim.id)
      .eq("status", "pending")
      .select("id");

    if (!confirmed?.length) {
      throw new Error("Claim was already resolved by someone else");
    }

    const { data: payRow, error: payErr } = await admin
      .from("pm_rent_payments")
      .insert({
        invoice_id: claim.invoice_id,
        amount: claim.amount_claimed,
        method: "manual",
        recorded_by_user_id: userId,
        source_claim_id: claim.id,
        note: `Confirmed from tenant-submitted claim, method: ${claim.method}`,
      })
      .select("id")
      .single();

    if (payErr) {
      // Release the claim so it stays actionable instead of stranded as confirmed-but-uncredited.
      await admin
        .from("pm_rent_payment_claims")
        .update({ status: "pending", resolved_at: null, resolved_by_user_id: null })
        .eq("id", claim.id);
      throw payErr;
    }

    await recordFeeAndDisburse(admin, {
      rentPaymentId: payRow.id,
      ownerUserId: property.owner_user_id,
      propertyId: property.id,
      grossAmount: Number(claim.amount_claimed),
    });

    const reconciled = await recomputeInvoiceStatus(admin, claim.invoice_id as string);
    return { success: true as const, ...reconciled };
  });

export const disputePmPaymentClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      claimId: z.string().uuid(),
      reason: z.string().trim().min(3).max(1000),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);
    const admin = asPmDb(await adminClient());

    const { data: claim } = await admin
      .from("pm_rent_payment_claims")
      .select("*")
      .eq("id", data.claimId)
      .maybeSingle();
    if (!claim) throw new Error("Claim not found");

    const propertyId = await propertyIdForInvoice(admin, claim.invoice_id as string);
    if (!propertyId) throw new Error("Invoice not found");
    await assertPmPropertyAccess(admin, userId, propertyId);

    if (claim.status !== "pending") {
      throw new Error(`Claim is already ${claim.status}`);
    }

    await admin
      .from("pm_rent_payment_claims")
      .update({
        status: "disputed",
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: userId,
      })
      .eq("id", data.claimId);

    await admin.from("admin_dispute_queue").insert({
      dispute_type: "rent_payment_claim",
      related_id: data.claimId,
      reason: data.reason,
      status: "open",
    });

    return { success: true as const, status: "disputed" as const };
  });

export const reversePmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      paymentId: z.string().uuid(),
      reason: z.string().trim().min(3).max(1000),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);
    const admin = asPmDb(await adminClient());

    const { data: payment } = await admin
      .from("pm_rent_payments")
      .select("id, invoice_id")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment) throw new Error("Payment not found");

    const propertyId = await propertyIdForInvoice(admin, payment.invoice_id as string);
    if (!propertyId) throw new Error("Invoice not found");
    const { staffRole } = await assertPmPropertyAccess(admin, userId, propertyId);
    assertStaffCan(staffRole, "payments:create");

    return createPaymentReversal(admin, {
      originalPaymentId: data.paymentId,
      reason: data.reason,
      recordedByUserId: userId,
    });
  });

export const listPmPaymentsForInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ invoiceId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, [...PORTAL_ROLES]);
    const admin = asPmDb(await adminClient());

    const propertyId = await propertyIdForInvoice(admin, data.invoiceId);
    if (!propertyId) throw new Error("Invoice not found");
    await assertPmPropertyAccess(admin, userId, propertyId);

    const { data: pays, error } = await admin
      .from("pm_rent_payments")
      .select("*")
      .eq("invoice_id", data.invoiceId)
      .order("paid_at", { ascending: true });
    if (error) throw error;
    return pays ?? [];
  });
