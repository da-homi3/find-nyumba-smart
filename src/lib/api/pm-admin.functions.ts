import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { adminClient, authContext } from "@/lib/api/nyumba/nyumba-shared";
import { asPmDb } from "@/lib/pm/access";
import { recomputeInvoiceStatus } from "@/lib/pm/invoice-integrity";

export type AdminPmClaimSummary = {
  id: string;
  amount_claimed: number;
  method: string;
  paid_on_date: string;
  attachment_url: string | null;
  note: string | null;
};

export type AdminPmOverview = {
  activePmSubscriptions: Array<{
    id: string;
    user_id: string;
    plan: string;
    status: string;
    amount_kes: number;
    trial_end: string | null;
    next_billing_date: string;
    created_at: string;
    full_name: string | null;
  }>;
  openDisputes: Array<{
    id: string;
    related_id: string;
    reason: string;
    claim: AdminPmClaimSummary | null;
  }>;
  recentReversals: Array<{
    id: string;
    amount: number;
    reversal_reason: string | null;
    paid_at: string;
    reversal_of_payment_id: string | null;
  }>;
};

type AdminDisputeRecord = {
  id: string;
  related_id: string;
  status: string;
};

type RentPaymentClaimRecord = {
  id: string;
  invoice_id: string;
  amount_claimed: number | string;
};

async function resolveLinkedProperty(admin: ReturnType<typeof asPmDb>, invoiceId: string) {
  const { data: invoice } = await admin
    .from("pm_rent_invoices")
    .select("lease_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return null;

  const { data: lease } = await admin.from("pm_leases").select("unit_id").eq("id", invoice.lease_id).maybeSingle();
  if (!lease) return null;

  const { data: unit } = await admin.from("pm_units").select("property_id").eq("id", lease.unit_id).maybeSingle();
  if (!unit) return null;

  const { data: property } = await admin
    .from("pm_properties")
    .select("id, owner_user_id")
    .eq("id", unit.property_id)
    .maybeSingle();
  return property;
}

async function confirmClaimAfterDispute(opts: {
  admin: ReturnType<typeof asPmDb>;
  claim: RentPaymentClaimRecord;
  userId: string;
  notes: string;
}) {
  const { admin, claim, userId, notes } = opts;
  const property = await resolveLinkedProperty(admin, claim.invoice_id);

  const { data: payRow, error: payErr } = await admin
    .from("pm_rent_payments")
    .insert({
      invoice_id: claim.invoice_id,
      amount: claim.amount_claimed,
      method: "manual",
      recorded_by_user_id: userId,
      source_claim_id: claim.id,
      note: `Admin-resolved dispute in tenant's favour: ${notes}`,
    })
    .select("id")
    .single();
  if (payErr) throw payErr;

  if (property) {
    try {
      const { recordPlatformFee } = await import("@/lib/pm/platform-fee");
      await recordPlatformFee(admin, {
        rentPaymentId: payRow.id,
        ownerUserId: property.owner_user_id,
        propertyId: property.id,
        grossAmount: Number(claim.amount_claimed),
      });
      const { disburseUnbatchedFeeNow } = await import("@/lib/pm/payout-batch");
      void disburseUnbatchedFeeNow(admin, {
        rentPaymentId: payRow.id,
        ownerUserId: property.owner_user_id,
        propertyId: property.id,
      }).catch((e) => console.warn("[pm] instant payout failed:", e));
    } catch (e) {
      console.warn("[pm] platform fee record failed:", e);
    }
  }

  await recomputeInvoiceStatus(admin, claim.invoice_id);
  await admin
    .from("pm_rent_payment_claims")
    .update({
      status: "confirmed",
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: userId,
    })
    .eq("id", claim.id);
}

async function markClaimDisputed(admin: ReturnType<typeof asPmDb>, claimId: string, userId: string) {
  await admin
    .from("pm_rent_payment_claims")
    .update({
      status: "disputed",
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: userId,
    })
    .eq("id", claimId);
}

export const getAdminPmOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPmOverview> => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = asPmDb(await adminClient());

    const { data: subRows, error: subErr } = await admin
      .from("subscriptions")
      .select("id, user_id, plan, status, amount_kes, trial_end, next_billing_date, created_at, module")
      .eq("module", "property_management")
      .order("created_at", { ascending: false })
      .limit(100);
    if (subErr) throw subErr;

    const { data: disputeRows, error: disputeErr } = await admin
      .from("admin_dispute_queue")
      .select("id, related_id, reason, status, created_at")
      .eq("dispute_type", "rent_payment_claim")
      .eq("status", "open")
      .order("created_at", { ascending: true });
    if (disputeErr) throw disputeErr;

    const { data: reversalRows, error: revErr } = await admin
      .from("pm_rent_payments")
      .select("id, amount, reversal_reason, paid_at, reversal_of_payment_id")
      .eq("is_reversal", true)
      .order("paid_at", { ascending: false })
      .limit(50);
    if (revErr) throw revErr;

    const userIds = [...new Set((subRows ?? []).map((s: { user_id: string }) => s.user_id))];
    const nameById: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", userIds);
      for (const p of profiles ?? []) {
        nameById[p.id as string] = (p.full_name as string | null) ?? null;
      }
    }

    const claimIds = (disputeRows ?? []).map((d: { related_id: string }) => d.related_id);
    const claimById: Record<string, AdminPmClaimSummary> = {};
    if (claimIds.length > 0) {
      const { data: claims } = await admin
        .from("pm_rent_payment_claims")
        .select("id, amount_claimed, method, paid_on_date, attachment_url, note")
        .in("id", claimIds);
      for (const c of claims ?? []) {
        claimById[c.id as string] = {
          id: c.id as string,
          amount_claimed: Number(c.amount_claimed),
          method: String(c.method),
          paid_on_date: String(c.paid_on_date),
          attachment_url: (c.attachment_url as string | null) ?? null,
          note: (c.note as string | null) ?? null,
        };
      }
    }

    return {
      activePmSubscriptions: (subRows ?? []).map(
        (s: {
          id: string;
          user_id: string;
          plan: string;
          status: string;
          amount_kes: number;
          trial_end: string | null;
          next_billing_date: string;
          created_at: string;
        }) => ({
          id: s.id,
          user_id: s.user_id,
          plan: s.plan,
          status: s.status,
          amount_kes: s.amount_kes,
          trial_end: s.trial_end,
          next_billing_date: s.next_billing_date,
          created_at: s.created_at,
          full_name: nameById[s.user_id] ?? null,
        }),
      ),
      openDisputes: (disputeRows ?? []).map((d: { id: string; related_id: string; reason: string }) => ({
        id: d.id,
        related_id: d.related_id,
        reason: d.reason,
        claim: claimById[d.related_id] ?? null,
      })),
      recentReversals: (reversalRows ?? []).map(
        (r: {
          id: string;
          amount: number;
          reversal_reason: string | null;
          paid_at: string;
          reversal_of_payment_id: string | null;
        }) => ({
          id: r.id,
          amount: Number(r.amount),
          reversal_reason: r.reversal_reason,
          paid_at: r.paid_at,
          reversal_of_payment_id: r.reversal_of_payment_id,
        }),
      ),
    };
  });

export const resolveAdminPmDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      disputeId: z.string().uuid(),
      outcome: z.enum(["uphold_tenant", "uphold_landlord"]),
      notes: z.string().trim().min(3).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = asPmDb(await adminClient());

    const { data: dispute } = await admin
      .from("admin_dispute_queue")
      .select("*")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute) throw new Error("Dispute not found");
    if (dispute.status !== "open") throw new Error("Dispute already resolved");

    const { data: claim } = await admin
      .from("pm_rent_payment_claims")
      .select("*")
      .eq("id", dispute.related_id)
      .maybeSingle();
    if (!claim) throw new Error("Related claim not found");

    if (data.outcome === "uphold_tenant") {
      await confirmClaimAfterDispute({
        admin,
        claim: claim as RentPaymentClaimRecord,
        userId,
        notes: data.notes,
      });
    } else {
      await markClaimDisputed(admin, claim.id, userId);
    }

    await admin
      .from("admin_dispute_queue")
      .update({
        status: "resolved",
        resolution_outcome: data.outcome,
        resolution_notes: data.notes,
        resolved_by_user_id: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.disputeId);

    await admin.from("admin_audit_logs").insert({
      admin_id: userId,
      action: "pm_dispute_resolve",
      target_id: data.disputeId,
      details: JSON.stringify({
        outcome: data.outcome,
        notes: data.notes,
        claimId: claim.id,
      }),
    });

    return { success: true as const };
  });
