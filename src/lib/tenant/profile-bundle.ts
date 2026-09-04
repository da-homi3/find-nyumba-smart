import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  computeTenantScore,
  TENANT_SCORE_RULES,
  type TenantScoreRule,
} from "@/lib/tenant/profile-score";

type Db = SupabaseClient<Database>;

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

async function loadPrefs(admin: Db, userId: string) {
  const { asLooseDb } = await import("@/lib/db/loose-client");
  const { data } = await asLooseDb(admin)
    .from("tenant_search_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

async function approvedTypes(admin: Db, userId: string): Promise<Set<string>> {
  const { asLooseDb } = await import("@/lib/db/loose-client");
  const { data } = await asLooseDb(admin)
    .from("verifications")
    .select("verification_type, status, expires_at")
    .eq("user_id", userId)
    .eq("status", "approved");
  const now = Date.now();
  return new Set(
    (data ?? [])
      .filter((row) => {
        const expires = row.expires_at as string | null;
        if (!expires) return true;
        return new Date(expires).getTime() > now;
      })
      .map((row) => asText(row.verification_type)),
  );
}

async function loadScoreRules(admin: Db): Promise<TenantScoreRule[]> {
  try {
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const { data } = await asLooseDb(admin).from("tenant_score_rules").select("*");
    if (!data?.length) return TENANT_SCORE_RULES;
    return data.map((row) => ({
      id: asText(row.id),
      name: asText(row.name),
      description: asText(row.description),
      points: Number(row.points) || 0,
      category: row.category === "verified" ? "verified" : "complete",
      tenantVisibility: row.tenant_visibility !== false,
      enabled: row.enabled !== false,
    }));
  } catch {
    return TENANT_SCORE_RULES;
  }
}

export async function loadTenantProfileBundle(admin: Db, userId: string) {
  const [{ data: profile }, prefs, types, authUser, rules] = await Promise.all([
    admin.from("profiles").select("full_name, phone, avatar_url").eq("id", userId).maybeSingle(),
    loadPrefs(admin, userId),
    approvedTypes(admin, userId),
    admin.auth.admin.getUserById(userId),
    loadScoreRules(admin),
  ]);
  const user = authUser.data.user;
  const locations = asText(prefs?.preferred_locations).trim();
  const budgetMin = Number(prefs?.budget_min) || 0;
  const budgetMax = Number(prefs?.budget_max) || 0;
  const score = computeTenantScore(
    {
      phoneVerified: types.has("phone"),
      emailVerified: Boolean(user?.email_confirmed_at),
      identityVerified: types.has("identity"),
      employmentVerified: types.has("employment"),
      incomeVerified: types.has("income"),
      tenancyProvided: Boolean(asText(prefs?.previous_tenancy).trim()),
      hasLocations: locations.length > 0,
      hasBudget: budgetMin > 0 || budgetMax > 0,
      hasMoveIn: Boolean(asText(prefs?.move_in_date).trim()),
      profileComplete: Boolean(profile?.full_name?.trim() && profile?.phone?.trim()),
    },
    rules,
  );

  return {
    fullName: profile?.full_name ?? user?.email ?? "Tenant",
    phone: profile?.phone ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    emailVerified: Boolean(user?.email_confirmed_at),
    prefs: {
      preferredLocations: locations,
      budgetMin,
      budgetMax,
      bedrooms: Number(prefs?.bedrooms) || 0,
      propertyType: asText(prefs?.property_type),
      moveInDate: asText(prefs?.move_in_date),
      previousTenancy: asText(prefs?.previous_tenancy),
      shareVisibility: (prefs?.share_visibility as string) === "link" ? "link" : "private",
      shareToken: (prefs?.share_token as string) || null,
    },
    score,
  };
}
