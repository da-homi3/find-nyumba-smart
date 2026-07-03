import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ensureTenantTrial } from "@/lib/payments/tenant-trial";
import { getTenantPlusStatus } from "@/lib/revenue/subscription-store";
import type { WaRole, WaSession } from "@/lib/whatsapp/types";
import { saveSession } from "@/lib/whatsapp/session";

type Admin = SupabaseClient<Database>;
type AppRole = Database["public"]["Enums"]["app_role"];

export type SavedHomePreview = {
  id: string;
  title: string;
  neighborhood: string;
  rentKes: number;
};

export type ViewingPreview = {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
};

export type ListingPreview = {
  title: string;
  isActive: boolean;
  views: number;
};

export type UserAssistantProfile = {
  userId: string;
  fullName: string;
  firstName: string;
  email: string | null;
  roles: AppRole[];
  tenantPlan: string;
  isPlus: boolean;
  trialUnlocksRemaining: number;
  trialActive: boolean;
  trialEndsAt: string | null;
  landlordPlan: string;
  savedCount: number;
  savedHomes: SavedHomePreview[];
  upcomingViewings: ViewingPreview[];
  activeListings: number;
  pendingListings: number;
  totalLeads: number;
  listingsPreview: ListingPreview[];
  providerBusiness: string | null;
  providerTier: string | null;
  providerStatus: string | null;
  lastSearchArea: string | null;
  recentUnlockCount: number;
};

const PROFILE_CACHE_MS = 5 * 60 * 1000;

const LANDLORD_ROLES = new Set<AppRole>(["landlord", "manager", "agency", "admin"]);
const PROVIDER_HINT_ROLES = new Set<AppRole>(["caretaker"]);

function firstNameFrom(fullName: string | null | undefined, fallback: string): string {
  const name = fullName?.trim();
  if (!name) return fallback;
  return name.split(/\s+/)[0] ?? fallback;
}

function waRoleFromAppRole(role: AppRole): WaRole | null {
  if (role === "tenant") return "tenant";
  if (LANDLORD_ROLES.has(role)) return role === "agency" ? "agent" : "landlord";
  if (role === "caretaker") return "provider";
  return null;
}

export function inferPrimaryWaRole(
  roles: AppRole[],
  opts?: { hasProviderProfile?: boolean; hasListings?: boolean },
): WaRole {
  if (opts?.hasProviderProfile || roles.some((r) => PROVIDER_HINT_ROLES.has(r))) {
    return "provider";
  }
  if (roles.some((r) => LANDLORD_ROLES.has(r)) && opts?.hasListings) {
    return roles.includes("agency") ? "agent" : "landlord";
  }
  if (roles.some((r) => LANDLORD_ROLES.has(r))) {
    return roles.includes("agency") ? "agent" : "landlord";
  }
  if (roles.includes("tenant")) return "tenant";
  return "tenant";
}

export async function loadUserAssistantProfile(
  admin: Admin,
  userId: string,
): Promise<UserAssistantProfile | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "full_name, tenant_plan, landlord_plan, trial_unlocks_remaining, trial_ends_at, active_portal",
    )
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;

  const [
    rolesRes,
    plus,
    trial,
    emailRes,
    savedRes,
    viewingsRes,
    listingsRes,
    providerRes,
    unlockCountRes,
  ] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId),
    getTenantPlusStatus(admin, userId),
    ensureTenantTrial(admin, userId),
    admin.auth.admin.getUserById(userId),
    admin
      .from("saved_properties")
      .select("property_id, properties(id, title, neighborhood, rent_kes)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("viewings")
      .select("id, scheduled_at, status, properties(title)")
      .eq("tenant_id", userId)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(3),
    admin
      .from("properties")
      .select("title, is_active, views")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("service_providers")
      .select("business_name, tier, status")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("contact_unlocks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const roles = (rolesRes.data ?? []).map((r) => r.role);
  const listings = listingsRes.data ?? [];
  const propertyIds =
    (await admin.from("properties").select("id").eq("owner_id", userId)).data?.map((p) => p.id) ??
    [];

  let totalLeads = 0;
  if (propertyIds.length > 0) {
    const { count } = await admin
      .from("contact_unlocks")
      .select("id", { count: "exact", head: true })
      .in("listing_id", propertyIds);
    totalLeads = count ?? 0;
  }

  const savedHomes: SavedHomePreview[] = (savedRes.data ?? [])
    .map((row) => {
      const p = row.properties as {
        id?: string;
        title?: string;
        neighborhood?: string;
        rent_kes?: number;
      } | null;
      if (!p?.id) return null;
      return {
        id: p.id,
        title: p.title ?? "Saved home",
        neighborhood: p.neighborhood ?? "",
        rentKes: p.rent_kes ?? 0,
      };
    })
    .filter((item): item is SavedHomePreview => item !== null);

  const upcomingViewings: ViewingPreview[] = (viewingsRes.data ?? []).map((v) => ({
    id: v.id,
    title: (v.properties as { title?: string } | null)?.title ?? "Viewing",
    scheduledAt: v.scheduled_at,
    status: v.status,
  }));

  const { count: savedTotal } = await admin
    .from("saved_properties")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return {
    userId,
    fullName: profile.full_name ?? "NyumbaSearch user",
    firstName: firstNameFrom(profile.full_name, "there"),
    email: emailRes.data.user?.email ?? null,
    roles,
    tenantPlan: plus.tenantPlan,
    isPlus: plus.tenantPlan === "plus",
    trialUnlocksRemaining: trial.trialUnlocksRemaining,
    trialActive: trial.trialActive,
    trialEndsAt: trial.trialEndsAt,
    landlordPlan: profile.landlord_plan ?? "free",
    savedCount: savedTotal ?? savedHomes.length,
    savedHomes,
    upcomingViewings,
    activeListings: listings.filter((l) => l.is_active).length,
    pendingListings: listings.filter((l) => !l.is_active).length,
    totalLeads,
    listingsPreview: listings.map((l) => ({
      title: l.title,
      isActive: l.is_active,
      views: l.views ?? 0,
    })),
    providerBusiness: providerRes.data?.business_name ?? null,
    providerTier: providerRes.data?.tier ?? null,
    providerStatus: providerRes.data?.status ?? null,
    lastSearchArea: null,
    recentUnlockCount: unlockCountRes.count ?? 0,
  };
}

export function getTimeGreeting(): string {
  const hour = new Date().getUTCHours() + 3; // EAT ≈ UTC+3
  const h = hour % 24;
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function appendPlanDigestLine(lines: string[], profile: UserAssistantProfile): void {
  if (profile.isPlus) {
    lines.push("✨ NyumbaSearch Plus — unlimited unlocks");
    return;
  }
  if (profile.trialActive && profile.trialUnlocksRemaining > 0) {
    const suffix = profile.trialUnlocksRemaining === 1 ? "" : "s";
    lines.push(`🎁 ${profile.trialUnlocksRemaining} free unlock${suffix} left in trial`);
  }
}

function appendNextViewingLine(lines: string[], profile: UserAssistantProfile): void {
  const next = profile.upcomingViewings[0];
  if (!next) return;
  const when = new Date(next.scheduledAt).toLocaleString("en-KE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  lines.push(`📅 Next viewing: ${next.title} — ${when}`);
}

function appendListingsDigestLine(lines: string[], profile: UserAssistantProfile): void {
  if (profile.activeListings <= 0 && profile.pendingListings <= 0) return;
  let listingLine = `🏠 Your listings: ${profile.activeListings} live`;
  if (profile.pendingListings > 0) {
    listingLine += `, ${profile.pendingListings} pending`;
  }
  lines.push(listingLine);
  if (profile.totalLeads > 0) {
    const leadSuffix = profile.totalLeads === 1 ? "" : "s";
    lines.push(`📥 ${profile.totalLeads} lead${leadSuffix} on your properties`);
  }
}

export function formatProfileDigest(profile: UserAssistantProfile): string {
  const lines: string[] = [];
  lines.push(`*${getTimeGreeting()}, ${profile.firstName}!*`);

  appendPlanDigestLine(lines, profile);

  if (profile.savedCount > 0) {
    const suffix = profile.savedCount === 1 ? "" : "s";
    lines.push(`❤️ ${profile.savedCount} saved home${suffix}`);
  }

  appendNextViewingLine(lines, profile);
  appendListingsDigestLine(lines, profile);

  if (profile.providerBusiness) {
    lines.push(`🔧 ${profile.providerBusiness} (${profile.providerTier ?? "basic"})`);
  }

  if (profile.lastSearchArea) {
    lines.push(`🔍 Last searched: ${profile.lastSearchArea}`);
  }

  return lines.join("\n");
}

function formatSavedHomeSummary(home: {
  title: string;
  neighborhood: string;
  rentKes: number;
}): string {
  return `${home.title} in ${home.neighborhood} KES ${home.rentKes}`;
}

function formatViewingSummary(viewing: { title: string; scheduledAt: string }): string {
  return `${viewing.title} on ${viewing.scheduledAt}`;
}

export function buildNyumbaAiProfileContext(profile: UserAssistantProfile | null): string {
  if (!profile) {
    return "The user is not linked to a NyumbaSearch account yet. Suggest they link via email for personalised help.";
  }

  const planLabel = profile.isPlus ? `${profile.tenantPlan} (Plus)` : profile.tenantPlan;
  const parts = [
    `User: ${profile.fullName}`,
    `Roles: ${profile.roles.join(", ") || "tenant"}`,
    `Tenant plan: ${planLabel}`,
  ];

  if (profile.trialActive) {
    parts.push(`Trial unlocks remaining: ${profile.trialUnlocksRemaining}`);
  }
  if (profile.savedCount > 0) {
    const savedSummary = profile.savedHomes.map(formatSavedHomeSummary).join("; ");
    parts.push(`Saved homes (${profile.savedCount}): ${savedSummary}`);
  }
  if (profile.upcomingViewings.length > 0) {
    const viewingSummary = profile.upcomingViewings.map(formatViewingSummary).join("; ");
    parts.push(`Upcoming viewings: ${viewingSummary}`);
  }
  if (profile.activeListings > 0) {
    parts.push(`Landlord: ${profile.activeListings} active listings, ${profile.totalLeads} leads`);
  }
  if (profile.lastSearchArea) {
    parts.push(`Recently searched neighbourhood: ${profile.lastSearchArea}`);
  }

  parts.push(
    "Act as their personal NyumbaSearch assistant. Reference their account details when relevant. Be warm and use their first name occasionally.",
  );

  return parts.join("\n");
}

export function availableWaRoles(profile: UserAssistantProfile): WaRole[] {
  const set = new Set<WaRole>();
  for (const r of profile.roles) {
    const mapped = waRoleFromAppRole(r);
    if (mapped) set.add(mapped);
  }
  if (profile.providerBusiness) set.add("provider");
  if (profile.activeListings > 0 || profile.pendingListings > 0) {
    set.add(profile.roles.includes("agency") ? "agent" : "landlord");
  }
  if (set.size === 0) set.add("tenant");
  return [...set];
}

function isProfileCacheFresh(session: WaSession): boolean {
  const cachedAt = session.context.profileCachedAt as number | undefined;
  if (!cachedAt) return false;
  return Date.now() - cachedAt < PROFILE_CACHE_MS;
}

export function invalidateProfileCache(session: WaSession): void {
  delete session.context.profile;
  delete session.context.profileCachedAt;
}

/** Force-refresh profile snapshot on session after data-changing actions. */
export async function refreshSessionProfile(
  admin: Admin,
  session: WaSession,
): Promise<UserAssistantProfile | null> {
  invalidateProfileCache(session);
  const profile = await getCachedUserProfile(admin, session, true);
  return profile;
}

export async function getCachedUserProfile(
  admin: Admin,
  session: WaSession,
  forceRefresh = false,
): Promise<UserAssistantProfile | null> {
  if (!session.userId) return null;

  if (!forceRefresh && isProfileCacheFresh(session)) {
    const snap = session.context.profile as UserAssistantProfile | undefined;
    if (snap?.userId === session.userId) return snap;
  }

  const profile = await loadUserAssistantProfile(admin, session.userId);
  if (profile) {
    const area = session.context.searchArea;
    if (typeof area === "string" && area) {
      profile.lastSearchArea = area;
    }
    session.context.profile = profile;
    session.context.profileCachedAt = Date.now();
    await saveSession(admin, session);
  }
  return profile;
}

/** Link session to profile by phone, infer role, cache profile snapshot. */
export async function hydrateSessionFromProfile(
  admin: Admin,
  session: WaSession,
  _senderName: string,
): Promise<UserAssistantProfile | null> {
  if (!session.userId) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", session.waPhone)
      .maybeSingle();
    if (data?.id) {
      session.userId = data.id;
    }
  }

  if (!session.userId) return null;

  const profile = await getCachedUserProfile(admin, session, false);
  if (!profile) return null;

  if (session.role === "unknown") {
    session.role = inferPrimaryWaRole(profile.roles, {
      hasProviderProfile: Boolean(profile.providerBusiness),
      hasListings: profile.activeListings + profile.pendingListings > 0,
    });
    await saveSession(admin, session);
  }

  return profile;
}

export function displayFirstName(profile: UserAssistantProfile | null, senderName: string): string {
  if (profile?.firstName) return profile.firstName;
  return senderName.split(/\s+/)[0] ?? "there";
}
