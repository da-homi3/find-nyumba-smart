import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";

const categories = [
  "electricians",
  "plumbers",
  "painters",
  "internet",
  "security",
  "movers",
  "cleaning",
  "solar",
] as const;

export const createServiceProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      businessName: z.string().min(2),
      categories: z.array(z.enum(categories)).min(1),
      areasServed: z.array(z.string().min(1)).min(1),
      description: z.string().optional(),
      priceRange: z.string().optional(),
      phone: z.string().min(9),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("service_providers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await supabaseAdmin
        .from("service_providers")
        .update({
          business_name: data.businessName,
          categories: data.categories,
          areas_served: data.areasServed,
          description: data.description ?? null,
          price_range: data.priceRange ?? null,
          phone: data.phone,
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      return { id: updated.id };
    }

    const { data: row, error } = await supabaseAdmin
      .from("service_providers")
      .insert({
        user_id: userId,
        business_name: data.businessName,
        categories: data.categories,
        areas_served: data.areasServed,
        description: data.description ?? null,
        price_range: data.priceRange ?? null,
        phone: data.phone,
        status: "pending",
        tier: "basic",
      })
      .select("id")
      .single();

    if (error) throw error;
    return { id: row.id };
  });

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

    const [{ data: subscription }, { data: inquiries }] = await Promise.all([
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
    ]);

    return { provider, subscription, inquiries: inquiries ?? [] };
  });

import { PROVIDER_TIERS } from "@/lib/revenue/plans";

export const SERVICE_PROVIDER_CATEGORIES = categories;

export { PROVIDER_TIERS };

export function providerTierPrice(tier: string): number {
  return PROVIDER_TIERS.find((t) => t.value === tier)?.priceKes ?? 1500;
}

export type PublicServiceProvider = {
  id: string;
  businessName: string;
  category: string;
  categories: string[];
  areasServed: string[];
  rating: number;
  reviewCount: number;
  startingPriceKes: number;
  description: string;
  phone: string;
  tier: string;
};

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
    description: string | null;
    price_range: string | null;
    phone: string;
    tier: string;
  },
  category?: string,
): PublicServiceProvider {
  const categories = Array.isArray(row.categories) ? (row.categories as string[]) : [];
  const areasServed = Array.isArray(row.areas_served) ? (row.areas_served as string[]) : [];
  return {
    id: row.id,
    businessName: row.business_name,
    category: category ?? categories[0] ?? "electricians",
    categories,
    areasServed,
    rating: 4.5,
    reviewCount: 0,
    startingPriceKes: parseStartingPrice(row.price_range),
    description: row.description ?? "",
    phone: row.phone,
    tier: row.tier,
  };
}

export const listActiveProvidersByCategory = createServerFn({ method: "GET" })
  .inputValidator(z.object({ category: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("service_providers")
      .select("id, business_name, categories, areas_served, description, price_range, phone, tier")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (rows ?? [])
      .filter((row) => {
        const categories = Array.isArray(row.categories) ? (row.categories as string[]) : [];
        return categories.includes(data.category);
      })
      .map((row) => mapProviderRow(row, data.category));
  });

export const getProviderById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("service_providers")
      .select(
        "id, business_name, categories, areas_served, description, price_range, phone, tier, status",
      )
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw error;
    if (row?.status !== "active") return null;
    return mapProviderRow(row);
  });
