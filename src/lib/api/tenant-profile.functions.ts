import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { computeTenantScore, TENANT_SCORE_RULES, type TenantScoreRule } from "@/lib/tenant/profile-score";

const prefsSchema = z.object({
  preferredLocations: z.string().trim().max(200).optional(),
  budgetMin: z.number().int().min(0).max(10_000_000).optional(),
  budgetMax: z.number().int().min(0).max(10_000_000).optional(),
  bedrooms: z.number().int().min(0).max(12).optional(),
  propertyType: z.string().trim().max(40).optional(),
  moveInDate: z.string().trim().max(20).optional(),
  previousTenancy: z.string().trim().max(500).optional(),
  shareVisibility: z.enum(["private", "link"]).optional(),
});

async function loadPrefs(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asLooseDb } = await import("@/lib/db/loose-client");
  const { data } = await asLooseDb(supabaseAdmin)
    .from("tenant_search_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

async function approvedTypes(userId: string): Promise<Set<string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asLooseDb } = await import("@/lib/db/loose-client");
  const { data } = await asLooseDb(supabaseAdmin)
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
      .map((row) => String(row.verification_type)),
  );
}

async function loadScoreRules(): Promise<TenantScoreRule[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const { data } = await asLooseDb(supabaseAdmin).from("tenant_score_rules").select("*");
    if (!data?.length) return TENANT_SCORE_RULES;
    return data.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      description: String(row.description ?? ""),
      points: Number(row.points) || 0,
      category: row.category === "verified" ? "verified" : "complete",
      tenantVisibility: row.tenant_visibility !== false,
      enabled: row.enabled !== false,
    }));
  } catch {
    return TENANT_SCORE_RULES;
  }
}

async function recordScoreHistory(userId: string, percent: number, reason: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const { data: last } = await asLooseDb(supabaseAdmin)
      .from("tenant_score_history")
      .select("percent")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && Number(last.percent) === percent) return;
    await asLooseDb(supabaseAdmin).from("tenant_score_history").insert({
      user_id: userId,
      percent,
      reason,
    });
  } catch (err) {
    console.warn("[tenant-score] history:", err);
  }
}

export const getTenantProfileBundle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    const [{ data: profile }, prefs, types, authUser, rules] = await Promise.all([
      supabase.from("profiles").select("full_name, phone, avatar_url").eq("id", userId).maybeSingle(),
      loadPrefs(userId),
      approvedTypes(userId),
      supabase.auth.getUser(),
      loadScoreRules(),
    ]);
    const user = authUser.data.user;
    const locations = String(prefs?.preferred_locations ?? "").trim();
    const budgetMin = Number(prefs?.budget_min) || 0;
    const budgetMax = Number(prefs?.budget_max) || 0;
    const score = computeTenantScore(
      {
        phoneVerified: types.has("phone"),
        emailVerified: Boolean(user?.email_confirmed_at),
        identityVerified: types.has("identity"),
        employmentVerified: types.has("employment"),
        incomeVerified: types.has("income"),
        tenancyProvided: Boolean(String(prefs?.previous_tenancy ?? "").trim()),
        hasLocations: locations.length > 0,
        hasBudget: budgetMin > 0 || budgetMax > 0,
        hasMoveIn: Boolean(String(prefs?.move_in_date ?? "").trim()),
        profileComplete: Boolean(profile?.full_name?.trim() && profile?.phone?.trim()),
      },
      rules,
    );
    void recordScoreHistory(userId, score.percent, "profile_view");
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
        propertyType: String(prefs?.property_type ?? ""),
        moveInDate: String(prefs?.move_in_date ?? ""),
        previousTenancy: String(prefs?.previous_tenancy ?? ""),
        shareVisibility: (prefs?.share_visibility as string) === "link" ? "link" : "private",
        shareToken: (prefs?.share_token as string) || null,
      },
      score,
    };
  });

export const updateTenantSearchPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(prefsSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const payload = {
      user_id: userId,
      preferred_locations: data.preferredLocations ?? "",
      budget_min: data.budgetMin ?? 0,
      budget_max: data.budgetMax ?? 0,
      bedrooms: data.bedrooms ?? 0,
      property_type: data.propertyType ?? "",
      move_in_date: data.moveInDate ?? "",
      previous_tenancy: data.previousTenancy ?? "",
      share_visibility: data.shareVisibility ?? "private",
      updated_at: new Date().toISOString(),
    };
    const { error } = await asLooseDb(supabaseAdmin)
      .from("tenant_search_profiles")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
    return { saved: true };
  });

export const createTenantProfileShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const token = `ns_${crypto.randomUUID().replaceAll("-", "")}`;
    const existing = await loadPrefs(userId);
    const { error } = await asLooseDb(supabaseAdmin).from("tenant_search_profiles").upsert(
      {
        user_id: userId,
        preferred_locations: existing?.preferred_locations ?? "",
        budget_min: existing?.budget_min ?? 0,
        budget_max: existing?.budget_max ?? 0,
        bedrooms: existing?.bedrooms ?? 0,
        property_type: existing?.property_type ?? "",
        move_in_date: existing?.move_in_date ?? "",
        previous_tenancy: existing?.previous_tenancy ?? "",
        share_visibility: "link",
        share_token: token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    const { recordProductEventCore } = await import("@/lib/analytics/product-events");
    void recordProductEventCore(userId, "tenant_profile_shared", {});
    return { token, path: `/t/${token}` };
  });

export const revokeTenantProfileShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    await asLooseDb(supabaseAdmin)
      .from("tenant_search_profiles")
      .update({ share_visibility: "private", share_token: null })
      .eq("user_id", userId);
    return { revoked: true };
  });

export const getPublicTenantCard = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().trim().min(10).max(80) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const { data: prefs } = await asLooseDb(supabaseAdmin)
      .from("tenant_search_profiles")
      .select("*")
      .eq("share_token", data.token)
      .eq("share_visibility", "link")
      .maybeSingle();
    if (!prefs) throw new Error("This tenant profile link is private or no longer active.");
    const userId = String(prefs.user_id);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const types = await approvedTypes(userId);
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const score = computeTenantScore({
      phoneVerified: types.has("phone"),
      emailVerified: Boolean(authUser.user?.email_confirmed_at),
      identityVerified: types.has("identity"),
      employmentVerified: types.has("employment"),
      incomeVerified: types.has("income"),
      tenancyProvided: Boolean(String(prefs.previous_tenancy ?? "").trim()),
      hasLocations: Boolean(String(prefs.preferred_locations ?? "").trim()),
      hasBudget: Number(prefs.budget_min) > 0 || Number(prefs.budget_max) > 0,
      hasMoveIn: Boolean(String(prefs.move_in_date ?? "").trim()),
      profileComplete: Boolean(profile?.full_name?.trim()),
    });
    return {
      fullName: profile?.full_name ?? "NyumbaSearch tenant",
      scorePercent: score.percent,
      verified: score.awarded.filter((a) => a.category === "verified").map((a) => a.name),
      lookingFor: prefs.bedrooms ? `${prefs.bedrooms} bedroom` : null,
      locations: String(prefs.preferred_locations ?? ""),
      budgetMin: Number(prefs.budget_min) || null,
      budgetMax: Number(prefs.budget_max) || null,
      moveInDate: String(prefs.move_in_date ?? ""),
      disclaimer: score.disclaimer,
    };
  });

export const getTenantScoreHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const { data } = await asLooseDb(supabaseAdmin)
      .from("tenant_score_history")
      .select("percent, reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(40);
    return (data ?? []).map((row) => ({
      percent: Number(row.percent) || 0,
      reason: String(row.reason ?? ""),
      createdAt: String(row.created_at),
    }));
  });
