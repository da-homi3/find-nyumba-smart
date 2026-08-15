import { PLUS_PLAN, getPlusPricing } from "@/lib/revenue/plus-plan";

export type PlusPlan = typeof PLUS_PLAN;

export async function getPlatformSetting<T extends Record<string, unknown>>(
  key: string,
  fallback: T,
): Promise<T> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const { data } = await asLooseDb(supabaseAdmin)
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (!data?.value || typeof data.value !== "object") return fallback;
    return { ...fallback, ...(data.value as T) };
  } catch {
    return fallback;
  }
}

export async function setPlatformSetting(key: string, value: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asLooseDb } = await import("@/lib/db/loose-client");
  const { error } = await asLooseDb(supabaseAdmin).from("platform_settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function resolvePlusPlan(): Promise<PlusPlan> {
  const overlay = await getPlatformSetting("tenant_plus_pricing", {
    monthlyKes: PLUS_PLAN.monthlyKes,
    quarterlyKes: PLUS_PLAN.quarterlyKes,
    quarterlyRegularKes: PLUS_PLAN.quarterlyRegularKes,
    contactCreditsPerMonth: PLUS_PLAN.contactCreditsPerMonth,
  });
  return {
    ...PLUS_PLAN,
    monthlyKes: Number(overlay.monthlyKes) || PLUS_PLAN.monthlyKes,
    quarterlyKes: Number(overlay.quarterlyKes) || PLUS_PLAN.quarterlyKes,
    quarterlyRegularKes: Number(overlay.quarterlyRegularKes) || PLUS_PLAN.quarterlyRegularKes,
    contactCreditsPerMonth:
      Number(overlay.contactCreditsPerMonth) || PLUS_PLAN.contactCreditsPerMonth,
  };
}

export async function resolvePlusPricing() {
  return getPlusPricing(await resolvePlusPlan());
}
