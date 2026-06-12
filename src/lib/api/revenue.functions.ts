import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { LISTING_LIMITS } from "@/lib/revenue/plans";
import {
  countActivePlusMembers,
  getActiveLandlordPlan,
  getTenantPlusStatus,
} from "@/lib/revenue/subscription-store";

export const getUserEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    const [landlordPlan, plus] = await Promise.all([
      getActiveLandlordPlan(supabase, userId),
      getTenantPlusStatus(supabase, userId),
    ]);

    return {
      landlordPlan,
      tenantPlan: plus.tenantPlan,
      plusExpiresAt: plus.plusExpiresAt,
      listingLimit: LISTING_LIMITS[landlordPlan] ?? 1,
    };
  });

export const listActiveBoostedPropertyIds = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();

  const { data: fromBoosts } = await supabaseAdmin
    .from("listing_boosts")
    .select("listing_id")
    .gte("end_date", now);

  const ids = new Set<string>();
  for (const row of fromBoosts ?? []) ids.add(row.listing_id);
  return Array.from(ids);
});

export const listLandlordLeadsPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    const { data, error } = await supabase
      .from("leads")
      .select(
        `
        id,
        listing_id,
        quality_score,
        source,
        created_at,
        properties ( title, neighborhood ),
        profiles!leads_tenant_id_fkey ( full_name, phone, email: id )
      `,
      )
      .eq("landlord_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // Table may not exist until migration runs
      return [];
    }
    return data ?? [];
  });

const markRentedSchema = z.object({
  propertyId: z.string().uuid(),
  rentAmountKes: z.number().int().positive(),
  tenantId: z.string().uuid().optional(),
});

export const markPropertyRented = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(markRentedSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const platformFee = Math.round(data.rentAmountKes * 0.05);

    await supabaseAdmin
      .from("properties")
      .update({ is_vacant: false, is_active: false })
      .eq("id", data.propertyId)
      .eq("owner_id", userId);

    await supabaseAdmin.from("rental_transactions").insert({
      listing_id: data.propertyId,
      landlord_id: userId,
      tenant_id: data.tenantId ?? null,
      rent_amount_kes: data.rentAmountKes,
      platform_fee_kes: platformFee,
      status: "pending",
    });

    return { platformFeeKes: platformFee };
  });

const recordLeadSchema = z.object({
  listingId: z.string().uuid(),
  source: z.enum(["view", "save", "message", "booking"]),
});

export const recordTenantLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(recordLeadSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", data.listingId)
      .eq("is_active", true)
      .maybeSingle();
    if (!property?.owner_id) return { recorded: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordLead } = await import("@/lib/revenue/record-lead");
    await recordLead(supabaseAdmin, {
      listingId: property.id,
      landlordId: property.owner_id,
      tenantId: userId,
      source: data.source,
    });
    return { recorded: true };
  });

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function bucketPaymentType(type: string): "boosts" | "verification" | "leads" | "plus" | "other" {
  if (type === "property_boost" || type === "featured_listing") return "boosts";
  if (type === "verification" || type === "report") return "verification";
  if (type === "lead_pack") return "leads";
  if (type === "tenant_plus" || type === "landlord_plan" || type === "premium_subscription") {
    return "plus";
  }
  return "other";
}

export const getAdminRevenueStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!roles?.some((r) => r.role === "admin")) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("amount_kes, payment_type, created_at")
      .eq("status", "completed")
      .gte("created_at", sixMonthsAgo.toISOString());

    const monthBuckets = new Map<
      string,
      {
        month: string;
        mrr: number;
        boosts: number;
        verification: number;
        leads: number;
        plus: number;
      }
    >();

    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthBuckets.set(key, {
        month: MONTH_LABELS[d.getMonth()] ?? "",
        mrr: 0,
        boosts: 0,
        verification: 0,
        leads: 0,
        plus: 0,
      });
    }

    for (const p of payments ?? []) {
      const created = new Date(p.created_at);
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      const bucket = monthBuckets.get(key);
      if (!bucket) continue;
      bucket.mrr += p.amount_kes;
      const stream = bucketPaymentType(p.payment_type);
      if (stream !== "other") bucket[stream] += p.amount_kes;
    }

    const chart = Array.from(monthBuckets.values());
    const latest = chart[chart.length - 1] ?? {
      month: "",
      mrr: 0,
      boosts: 0,
      verification: 0,
      leads: 0,
      plus: 0,
    };
    const plusMembers = await countActivePlusMembers(supabaseAdmin);

    return {
      mrrKes: latest.mrr,
      plusMembers,
      paymentCount: payments?.length ?? 0,
      chart,
      latest,
    };
  });
