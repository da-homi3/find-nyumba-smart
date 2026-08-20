import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { asLooseDb } from "@/lib/db/loose-client";
import { listerPortalFromRoles } from "@/lib/portal-paths";
import { hasPaidMarketplacePortalAccess } from "@/lib/revenue/subscription-store";
import {
  benefitsForAudience,
  currentInvoicePeriod,
  emptyDemand,
  invoiceNumber,
  payUrlForInvoice,
  planForAudience,
  type InvoiceAudience,
  type InvoiceDemand,
  type InvoiceDraft,
} from "@/lib/revenue/subscription-invoice";

type Admin = SupabaseClient<Database>;

export async function markOpenInvoicesPaid(admin: Admin, userId: string): Promise<void> {
  try {
    await asLooseDb(admin)
      .from("platform_subscription_invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "open");
  } catch (err) {
    console.warn("[invoices] mark paid:", err);
  }
}

export async function upsertSubscriptionInvoice(admin: Admin, draft: InvoiceDraft): Promise<void> {
  try {
    const { error } = await asLooseDb(admin).from("platform_subscription_invoices").upsert(
      {
        user_id: draft.userId,
        audience: draft.audience,
        plan_id: draft.planId,
        invoice_number: draft.invoiceNumber,
        period_start: draft.periodStart,
        period_end: draft.periodEnd,
        amount_kes: draft.amountKes,
        status: "open",
        pay_path: draft.payUrl,
        demand_summary: draft.demand,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,audience,period_start" },
    );
    if (error) console.warn("[invoices] upsert:", error.message);
  } catch (err) {
    console.warn("[invoices] table missing?", err);
  }
}

export async function loadOwnerDemand(admin: Admin, userId: string): Promise<InvoiceDemand> {
  const demand = emptyDemand();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const { data: properties } = await admin
    .from("properties")
    .select("id, neighborhood, views")
    .eq("owner_id", userId);

  const hoods = new Set<string>();
  for (const row of properties ?? []) {
    demand.views += Number(row.views) || 0;
    if (row.neighborhood) hoods.add(row.neighborhood);
  }
  demand.areas = [...hoods].slice(0, 4);

  const { count: inquiryCount } = await admin
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("landlord_id", userId)
    .gte("created_at", sinceIso);
  demand.inquiries = inquiryCount ?? 0;

  if (hoods.size > 0) {
    const { data: searches } = await admin
      .from("search_events")
      .select("neighborhood")
      .gte("created_at", sinceIso)
      .limit(2000);
    const lower = [...hoods].map((h) => h.toLowerCase());
    demand.searches = (searches ?? []).filter((row) => {
      const hood = (row.neighborhood ?? "").toLowerCase();
      return hood.length > 0 && lower.some((h) => hood.includes(h) || h.includes(hood));
    }).length;
  }

  return demand;
}

export async function loadProviderDemand(
  admin: Admin,
  providerId: string,
  categories: string[],
  areas: string[],
): Promise<InvoiceDemand> {
  const demand = emptyDemand();
  demand.categories = categories.slice(0, 3);
  demand.areas = areas.slice(0, 3);
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { count } = await admin
    .from("provider_inquiries")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId)
    .gte("created_at", since.toISOString());
  demand.inquiries = count ?? 0;

  const { data: searches } = await admin
    .from("search_events")
    .select("query, neighborhood")
    .gte("created_at", since.toISOString())
    .limit(2000);
  const needles = [...categories, ...areas].map((s) => s.toLowerCase()).filter(Boolean);
  demand.searches = (searches ?? []).filter((row) => {
    const blob = `${row.query ?? ""} ${row.neighborhood ?? ""}`.toLowerCase();
    return needles.some((n) => n.length > 2 && blob.includes(n));
  }).length;

  return demand;
}

export async function hasPaidProviderSubscription(admin: Admin, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("subscriptions")
    .select("plan, status, next_billing_date, amount_kes")
    .eq("user_id", userId)
    .in("plan", ["basic", "featured", "premium"])
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(8);
  const now = Date.now();
  return (data ?? []).some(
    (row) =>
      new Date(row.next_billing_date).getTime() > now && Number(row.amount_kes ?? 0) > 0,
  );
}

export async function portalAudienceForUser(admin: Admin, userId: string): Promise<InvoiceAudience | null> {
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const set = new Set((roles ?? []).map((r) => r.role));
  if (set.has("admin")) return null;
  if (!set.has("landlord") && !set.has("manager") && !set.has("agency")) return null;
  return listerPortalFromRoles({
    isLandlord: set.has("landlord"),
    isManager: set.has("manager"),
    isAgency: set.has("agency"),
  });
}

export async function buildOwnerInvoice(admin: Admin, userId: string): Promise<InvoiceDraft | null> {
  const audience = await portalAudienceForUser(admin, userId);
  if (!audience || audience === "provider") return null;
  if (await hasPaidMarketplacePortalAccess(admin, userId)) return null;
  const period = currentInvoicePeriod();
  const plan = planForAudience(audience);
  const number = invoiceNumber(audience, userId, period.monthKey);
  return {
    userId,
    audience,
    planId: plan.planId,
    planName: plan.planName,
    amountKes: plan.amountKes,
    invoiceNumber: number,
    periodStart: period.startIso,
    periodEnd: period.endIso,
    monthKey: period.monthKey,
    payUrl: payUrlForInvoice(audience, plan.planId, number),
    benefits: benefitsForAudience(audience),
    demand: await loadOwnerDemand(admin, userId),
  };
}

export async function buildProviderInvoice(
  admin: Admin,
  userId: string,
  provider: { id: string; tier: string; categories: unknown; areas_served: unknown },
): Promise<InvoiceDraft | null> {
  if (await hasPaidProviderSubscription(admin, userId)) return null;
  const period = currentInvoicePeriod();
  const plan = planForAudience("provider", provider.tier);
  const number = invoiceNumber("provider", userId, period.monthKey);
  const categories = Array.isArray(provider.categories)
    ? provider.categories.map(String)
    : [];
  const areas = Array.isArray(provider.areas_served) ? provider.areas_served.map(String) : [];
  return {
    userId,
    audience: "provider",
    planId: plan.planId,
    planName: plan.planName,
    amountKes: plan.amountKes,
    invoiceNumber: number,
    periodStart: period.startIso,
    periodEnd: period.endIso,
    monthKey: period.monthKey,
    payUrl: payUrlForInvoice("provider", plan.planId, number),
    benefits: benefitsForAudience("provider"),
    demand: await loadProviderDemand(admin, provider.id, categories, areas),
  };
}
