import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { getAuthContext } from "@/lib/api/server-context";
import { getSiteUrl } from "@/lib/site";
import { isProviderPhoneVerified, providerWebsiteHref } from "@/lib/service-provider-contact";
import {
  countyNameForCode,
  isValidCountyCode,
  normalizeProviderCounties,
  PROVIDER_COUNTIES,
} from "@/lib/provider-counties";

const categories = [
  "electricians",
  "plumbers",
  "painters",
  "internet",
  "security",
  "movers",
  "cleaning",
  "solar",
  "pest_control",
  "carpentry",
  "furniture",
  "interior_design",
  "appliance_repair",
  "gardening",
  "water_services",
  "generators",
  "moving_supplies",
  "ac_repair",
  "laundry",
  "locksmiths",
  "roofing",
  "mama_fua",
  "nanny",
  "gas_delivery",
  "delivery",
  "courier",
] as const;

export const providerProfileSchema = z.object({
  businessName: z.string().min(2),
  categories: z.array(z.enum(categories)).min(1),
  areasServed: z.array(z.string().min(1)).min(1),
  counties: z.array(z.string().min(1)).min(1).optional(),
  description: z.string().optional(),
  priceRange: z.string().optional(),
  phone: z.string().min(9),
  sourceUrl: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^https?:\/\/.+/i.test(v), "Enter a valid website URL"),
});

export type ProviderProfileInput = z.infer<typeof providerProfileSchema>;

export const createServiceProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(providerProfileSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("service_providers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { data: current } = await supabaseAdmin
        .from("service_providers")
        .select("status")
        .eq("id", existing.id)
        .maybeSingle();
      // Rejected applicants can re-submit into the waitlist.
      const resubmit = current?.status === "rejected" ? { status: "pending" as const } : {};
      const { data: updated, error } = await supabaseAdmin
        .from("service_providers")
        .update({
          business_name: data.businessName,
          categories: data.categories,
          areas_served: data.areasServed,
          counties: data.counties ?? ["Nairobi"],
          description: data.description ?? null,
          price_range: data.priceRange ?? null,
          phone: data.phone,
          source_url: data.sourceUrl?.trim() || null,
          ...resubmit,
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      if (resubmit.status === "pending") {
        await notifyOpsProviderWaitlist({
          userId,
          businessName: data.businessName,
          phone: data.phone,
        });
      }
      return { id: updated.id };
    }

    const { data: row, error } = await supabaseAdmin
      .from("service_providers")
      .insert({
        user_id: userId,
        business_name: data.businessName,
        categories: data.categories,
        areas_served: data.areasServed,
        counties: data.counties ?? ["Nairobi"],
        description: data.description ?? null,
        price_range: data.priceRange ?? null,
        phone: data.phone,
        source_url: data.sourceUrl?.trim() || null,
        status: "pending",
        tier: "basic",
      })
      .select("id")
      .single();

    if (error) throw error;

    await notifyOpsProviderWaitlist({
      userId,
      businessName: data.businessName,
      phone: data.phone,
    });

    return { id: row.id };
  });

async function notifyOpsProviderWaitlist(opts: {
  userId: string;
  businessName: string;
  phone: string;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyOpsNewApplication } = await import("@/lib/api/notify");
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(opts.userId);
    await notifyOpsNewApplication({
      applicantName: opts.businessName,
      applicantEmail: userData.user?.email ?? opts.phone,
      role: "service_provider",
      orgName: opts.businessName,
      reviewUrl: `${getSiteUrl()}/admin?tab=providers`,
    });
  } catch (err) {
    console.warn("[service-provider] ops waitlist notify failed", err);
  }
}

export const getProviderDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: provider } = await supabaseAdmin
      .from("service_providers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!provider) return { provider: null, subscription: null, inquiries: [] };

    const [{ data: subscription }, { data: inquiries }, { data: quoteLeads }] = await Promise.all([
      provider.subscription_id
        ? supabaseAdmin
            .from("subscriptions")
            .select("*")
            .eq("id", provider.subscription_id)
            .maybeSingle()
        : supabaseAdmin
            .from("subscriptions")
            .select("*")
            .eq("user_id", userId)
            .in("plan", ["basic", "featured", "premium"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
      supabaseAdmin
        .from("provider_inquiries")
        .select("*, profiles:tenant_user_id(full_name, phone)")
        .eq("provider_id", provider.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("partnership_inquiries")
        .select("*")
        .eq("inquiry_type", "service_quote")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const mergedQuotes = [
      ...(inquiries ?? []),
      ...(quoteLeads ?? [])
        .filter((row) => {
          const meta = row.metadata as Record<string, string> | null;
          return meta?.providerId === provider.id || meta?.provider === provider.business_name;
        })
        .map((row) => ({
          id: row.id,
          message: `${row.message}\n\n${row.contact_name} · ${row.phone}`,
          created_at: row.created_at,
          profiles: { full_name: row.contact_name, phone: row.phone },
        })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { provider, subscription, inquiries: mergedQuotes };
  });

export const updateServiceProviderProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(providerProfileSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: provider, error: fetchErr } = await supabaseAdmin
      .from("service_providers")
      .select("id, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchErr || !provider) throw new Error("Provider profile not found");
    if (provider.status === "suspended") {
      throw new Error("Your account is suspended. Contact customer care.");
    }

    const { data: updated, error } = await supabaseAdmin
      .from("service_providers")
      .update({
        business_name: data.businessName,
        categories: data.categories,
        areas_served: data.areasServed,
        counties: data.counties ?? ["Nairobi"],
        description: data.description ?? null,
        price_range: data.priceRange ?? null,
        phone: data.phone,
        source_url: data.sourceUrl?.trim() || null,
      })
      .eq("id", provider.id)
      .select("id")
      .single();
    if (error) throw error;
    return { id: updated.id };
  });

const ANALYTICS_EVENT_TYPES = [
  "profile_view",
  "directory_view",
  "contact_click",
  "quote_request",
] as const;

export type ProviderAnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export type ProviderAnalyticsSummary = {
  profileViews: number;
  directoryViews: number;
  contactClicks: number;
  quoteRequests: number;
  inquiriesTotal: number;
  conversionRate: number;
  viewsByDay: { date: string; views: number }[];
  eventsByType: { type: string; count: number }[];
};

export const trackProviderEvent = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      providerId: z.string().uuid(),
      eventType: z.enum(ANALYTICS_EVENT_TYPES),
      metadata: z.record(z.string(), z.string()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: provider } = await supabaseAdmin
      .from("service_providers")
      .select("id, status")
      .eq("id", data.providerId)
      .maybeSingle();
    if (provider?.status !== "active") return { ok: false as const };

    const { error } = await supabaseAdmin.from("provider_analytics_events").insert({
      provider_id: data.providerId,
      event_type: data.eventType,
      metadata: data.metadata ?? {},
    });
    if (error) {
      console.warn("[provider-analytics] track failed", error.message);
      return { ok: false as const };
    }
    return { ok: true as const };
  });

function formatDayKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
}

export const getProviderAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: provider } = await supabaseAdmin
      .from("service_providers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const empty: ProviderAnalyticsSummary = {
      profileViews: 0,
      directoryViews: 0,
      contactClicks: 0,
      quoteRequests: 0,
      inquiriesTotal: 0,
      conversionRate: 0,
      viewsByDay: [],
      eventsByType: ANALYTICS_EVENT_TYPES.map((type) => ({ type, count: 0 })),
    };
    if (!provider) return empty;

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [{ data: events, error: eventsErr }, { data: inquiries }, { data: quoteLeads }] =
      await Promise.all([
        supabaseAdmin
          .from("provider_analytics_events")
          .select("event_type, created_at")
          .eq("provider_id", provider.id)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: true }),
        supabaseAdmin
          .from("provider_inquiries")
          .select("id")
          .eq("provider_id", provider.id)
          .gte("created_at", since.toISOString()),
        supabaseAdmin
          .from("partnership_inquiries")
          .select("id, metadata")
          .eq("inquiry_type", "service_quote")
          .gte("created_at", since.toISOString()),
      ]);

    const quoteLeadCount = (quoteLeads ?? []).filter((row) => {
      const meta = row.metadata as Record<string, string> | null;
      return meta?.providerId === provider.id;
    }).length;
    const inquiriesTotal = (inquiries?.length ?? 0) + quoteLeadCount;

    if (eventsErr) {
      return {
        ...empty,
        inquiriesTotal,
        quoteRequests: inquiriesTotal,
      };
    }

    const counts: Record<ProviderAnalyticsEventType, number> = {
      profile_view: 0,
      directory_view: 0,
      contact_click: 0,
      quote_request: 0,
    };
    const dayMap = new Map<string, number>();

    for (const row of events ?? []) {
      const type = row.event_type as ProviderAnalyticsEventType;
      if (type in counts) counts[type]++;
      const day = formatDayKey(row.created_at);
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    }

    const profileViews = counts.profile_view;
    const quoteRequests = Math.max(counts.quote_request, inquiriesTotal);
    const conversionRate =
      profileViews > 0 ? Math.round((quoteRequests / profileViews) * 1000) / 10 : 0;

    return {
      profileViews,
      directoryViews: counts.directory_view,
      contactClicks: counts.contact_click,
      quoteRequests,
      inquiriesTotal,
      conversionRate,
      viewsByDay: [...dayMap.entries()].map(([date, views]) => ({ date, views })),
      eventsByType: ANALYTICS_EVENT_TYPES.map((type) => ({
        type,
        count: counts[type],
      })),
    };
  });

import { PROVIDER_TIERS } from "@/lib/revenue/plans";

export const SERVICE_PROVIDER_CATEGORIES = categories;

export { PROVIDER_TIERS };

export function providerTierPrice(tier: string): number {
  return PROVIDER_TIERS.find((t) => t.value === tier)?.priceKes ?? 500;
}

export type PublicServiceProvider = {
  id: string;
  businessName: string;
  category: string;
  categories: string[];
  areasServed: string[];
  counties: string[];
  rating: number;
  reviewCount: number;
  startingPriceKes: number;
  description: string;
  phone: string;
  phoneVerified: boolean;
  sourceUrl: string | null;
  websiteUrl: string | null;
  tier: string;
  isPlaceholder?: boolean;
};

export function normalizeProviderCategories(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((c): c is string => typeof c === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

const TIER_RANK: Record<string, number> = { featured: 0, premium: 1, basic: 2 };

export function sortServiceProviders<
  T extends { tier: string; businessName: string; phoneVerified?: boolean; verified?: number },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const tierDiff = (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9);
    if (tierDiff !== 0) return tierDiff;
    const aVerified = a.phoneVerified ? 1 : (a.verified ?? 0);
    const bVerified = b.phoneVerified ? 1 : (b.verified ?? 0);
    if (bVerified !== aVerified) return bVerified - aVerified;
    return a.businessName.localeCompare(b.businessName);
  });
}

function parseStartingPrice(priceRange: string | null | undefined): number {
  if (!priceRange) return 1500;
  const priceDigits = /[\d,]+/;
  const match = priceDigits.exec(priceRange);
  if (!match) return 1500;
  return Number.parseInt(match[0].replaceAll(",", ""), 10) || 1500;
}

function mapProviderRow(
  row: {
    id: string;
    business_name: string;
    categories: unknown;
    areas_served: unknown;
    counties?: unknown;
    description: string | null;
    price_range: string | null;
    phone: string | null;
    tier: string;
    verified?: number | null;
    source_url?: string | null;
  },
  category?: string,
): PublicServiceProvider {
  const categories = normalizeProviderCategories(row.categories);
  const areasServed = Array.isArray(row.areas_served) ? (row.areas_served as string[]) : [];
  const counties = normalizeProviderCounties(row.counties);
  const phone = row.phone?.trim() ?? "";
  const sourceUrl = row.source_url?.trim() || null;
  const phoneVerified = isProviderPhoneVerified(row.verified, phone);
  return {
    id: row.id,
    businessName: row.business_name,
    category: category ?? categories[0] ?? "electricians",
    categories,
    areasServed,
    counties,
    rating: 4.5,
    reviewCount: 0,
    startingPriceKes: parseStartingPrice(row.price_range),
    description: row.description ?? "",
    phone,
    phoneVerified,
    sourceUrl,
    websiteUrl: providerWebsiteHref(sourceUrl),
    tier: row.tier,
  };
}

export const listProviderCounties = createServerFn({ method: "GET" }).handler(async () => {
  return PROVIDER_COUNTIES.map(({ code, name }) => ({ code, name }));
});

export const getProviderCategoryCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("service_providers")
    .select("categories")
    .eq("status", "active");

  if (error) throw error;

  const counts = Object.fromEntries(categories.map((id) => [id, 0])) as Record<
    (typeof categories)[number],
    number
  >;

  for (const row of rows ?? []) {
    for (const cat of normalizeProviderCategories(row.categories)) {
      if (cat in counts) counts[cat as (typeof categories)[number]]++;
    }
  }

  return counts;
});

export const listActiveProvidersByCategory = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      category: z.string().min(1),
      county: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mergeWithPlaceholders } = await import("@/data/service-placeholders");
    const countyName = isValidCountyCode(data.county) ? countyNameForCode(data.county) : null;

    let query = supabaseAdmin
      .from("service_providers")
      .select(
        "id, business_name, categories, areas_served, counties, description, price_range, phone, tier, verified, source_url",
      )
      .eq("status", "active")
      .filter("categories", "cs", JSON.stringify([data.category]))
      .order("tier", { ascending: true })
      .order("verified", { ascending: false })
      .order("business_name", { ascending: true })
      .limit(500);

    if (countyName) {
      query = query.contains("counties", JSON.stringify([countyName]));
    }

    const { data: rows, error } = await query;

    if (error) throw error;

    const live = sortServiceProviders(
      (rows ?? []).map((row) => ({
        ...mapProviderRow(row, data.category),
        isPlaceholder: false as const,
      })),
    );

    if (countyName) {
      return live;
    }

    return mergeWithPlaceholders(live, data.category);
  });

export const getProviderById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { getPlaceholderProviderById } = await import("@/data/service-placeholders");
    const placeholder = getPlaceholderProviderById(data.id);
    if (placeholder) return placeholder;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("service_providers")
      .select(
        "id, business_name, categories, areas_served, counties, description, price_range, phone, tier, status, verified, source_url",
      )
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw error;
    if (row?.status !== "active") return null;
    return { ...mapProviderRow(row), isPlaceholder: false };
  });

export const listPendingServiceProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("service_providers")
      .select(
        "id, user_id, business_name, categories, areas_served, description, price_range, phone, tier, status, created_at",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!rows?.length) return [];

    const userIds = [
      ...new Set(rows.map((r) => r.user_id).filter((id): id is string => id !== null)),
    ];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const emails = new Map<string, string>();
    await Promise.all(
      userIds.map(async (id) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(id);
        if (data.user?.email) emails.set(id, data.user.email);
      }),
    );

    return rows.map((row) => ({
      ...row,
      profiles: row.user_id ? (profileMap.get(row.user_id) ?? null) : null,
      email: row.user_id ? (emails.get(row.user_id) ?? null) : null,
    }));
  });

export const reviewServiceProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      providerId: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      rejectionReason: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyApplicantApproved, notifyApplicantRejected } = await import("@/lib/api/notify");

    const { data: provider, error: fetchErr } = await supabaseAdmin
      .from("service_providers")
      .select("id, user_id, business_name, status")
      .eq("id", data.providerId)
      .single();
    if (fetchErr || !provider) throw new Error("Provider application not found");
    if (!provider.user_id) throw new Error("Provider application has no linked user");

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(provider.user_id);
    const email = userData.user?.email ?? "";
    const name =
      (userData.user?.user_metadata?.full_name as string | undefined) ??
      provider.business_name ??
      email;

    if (data.action === "reject") {
      await supabaseAdmin
        .from("service_providers")
        .update({ status: "rejected" })
        .eq("id", data.providerId);
      await notifyApplicantRejected({
        email,
        name,
        role: "service provider",
        reason: data.rejectionReason,
      });
      await supabaseAdmin.from("admin_audit_logs").insert({
        admin_id: userId,
        action: "SERVICE_PROVIDER_REJECTED",
        target_id: data.providerId,
        details: `Rejected ${provider.business_name}. ${data.rejectionReason ?? ""}`,
      });
      return { status: "rejected" as const };
    }

    await supabaseAdmin
      .from("service_providers")
      .update({ status: "active" })
      .eq("id", data.providerId);

    await notifyApplicantApproved({
      email,
      name,
      role: "service_provider",
    });

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: userId,
      action: "SERVICE_PROVIDER_APPROVED",
      target_id: data.providerId,
      details: `Approved ${provider.business_name}`,
    });

    return { status: "approved" as const };
  });
