import { PORTAL_PATHS, type ListingPortal } from "@/lib/portal-paths";
import {
  AGENCY_PLANS,
  LANDLORD_PLANS,
  MANAGER_PLANS,
  PORTAL_UPGRADE_PLAN,
  PROVIDER_TIERS,
  planMonthlyPrice,
  providerTierPrice,
} from "@/lib/revenue/plans";
import { getSiteUrl } from "@/lib/site";

export type InvoiceAudience = ListingPortal | "provider";

export type InvoiceDemand = {
  searches: number;
  views: number;
  inquiries: number;
  areas: string[];
  categories: string[];
};

export type InvoiceDraft = {
  userId: string;
  audience: InvoiceAudience;
  planId: string;
  planName: string;
  amountKes: number;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  monthKey: string;
  payUrl: string;
  benefits: string[];
  demand: InvoiceDemand;
};

export function currentInvoicePeriod(now = new Date()): {
  startIso: string;
  endIso: string;
  monthKey: string;
} {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
    monthKey: start.toISOString().slice(0, 7),
  };
}

export function invoiceNumber(audience: InvoiceAudience, userId: string, monthKey: string): string {
  const short = userId.replaceAll("-", "").slice(0, 8).toUpperCase();
  const prefix = audience.slice(0, 3).toUpperCase();
  return `NS-${prefix}-${monthKey.replace("-", "")}-${short}`;
}

export function payUrlForInvoice(audience: InvoiceAudience, planId: string, invoiceNo: string): string {
  const ref = encodeURIComponent(invoiceNo);
  if (audience === "provider") {
    return `${getSiteUrl()}/services/provider/dashboard?plan=${encodeURIComponent(planId)}&ref=invoice&invoice=${ref}`;
  }
  const checkout = PORTAL_PATHS[audience].checkout;
  return `${getSiteUrl()}${checkout}?plan=${encodeURIComponent(planId)}&ref=invoice&invoice=${ref}`;
}

function catalogForPortal(audience: ListingPortal) {
  if (audience === "agency") return AGENCY_PLANS;
  if (audience === "manager") return MANAGER_PLANS;
  return LANDLORD_PLANS;
}

export function benefitsForAudience(audience: InvoiceAudience): string[] {
  if (audience === "provider") {
    return [
      "Appear in the NyumbaSearch services directory tenants actually browse",
      "Get inquiries from people looking for your trade in Nairobi",
      "Verified listing with phone and WhatsApp contact",
      "Higher placement when you choose Featured or Premium",
    ];
  }
  const plan = catalogForPortal(audience).find((p) => p.id === PORTAL_UPGRADE_PLAN[audience]);
  return plan?.features ?? [
    "Publish listings so tenants can find your homes",
    "See who saved and inquired on your properties",
    "Message interested tenants directly",
  ];
}

export function planForAudience(
  audience: InvoiceAudience,
  preferredPlan?: string | null,
): { planId: string; planName: string; amountKes: number } {
  if (audience === "provider") {
    const tier = preferredPlan === "featured" || preferredPlan === "premium" ? preferredPlan : "basic";
    const row = PROVIDER_TIERS.find((t) => t.value === tier) ?? PROVIDER_TIERS[0];
    return { planId: row.value, planName: `${row.label} provider`, amountKes: providerTierPrice(row.value) };
  }
  const planId = PORTAL_UPGRADE_PLAN[audience];
  const row = catalogForPortal(audience).find((p) => p.id === planId);
  return {
    planId,
    planName: row?.name ?? "Listing plan",
    amountKes: planMonthlyPrice(planId, "monthly"),
  };
}

export function demandHeadline(demand: InvoiceDemand, audience: InvoiceAudience): string {
  const area = demand.areas[0] ?? "Nairobi";
  if (audience === "provider") {
    const trade = demand.categories[0] ?? "your services";
    if (demand.inquiries > 0) {
      return `${demand.inquiries} people asked about ${trade} on NyumbaSearch this month`;
    }
    if (demand.searches > 0) {
      return `Tenants searched for ${trade} ${demand.searches} times this month`;
    }
    return `People on NyumbaSearch are looking for ${trade} in ${area}`;
  }
  if (demand.searches > 0) {
    return `${demand.searches} tenant searches in ${area} this month`;
  }
  if (demand.views > 0) {
    return `Your homes have ${demand.views} views from people looking to rent`;
  }
  if (demand.inquiries > 0) {
    return `${demand.inquiries} tenants already tried to reach you`;
  }
  return `Tenants are searching NyumbaSearch every day for homes in ${area}`;
}

export function emptyDemand(): InvoiceDemand {
  return { searches: 0, views: 0, inquiries: 0, areas: [], categories: [] };
}
