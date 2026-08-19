import { mobileError, mobileJson, requireMobileBearer } from "@/lib/api/mobile/v1/auth";
import { parseJsonBody, parseUuid } from "@/lib/api/mobile/v1/helpers";
import type { NotificationPreferences } from "@/lib/notifications/types";

const PREF_KEYS = [
  "announcements",
  "listings",
  "messages",
  "maintenance",
  "payments",
  "account",
  "push_enabled",
] as const satisfies ReadonlyArray<keyof NotificationPreferences>;

// ── Entitlements / current subscription ──────────────────────────────────────

async function handleSubscriptionsCurrent(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  try {
    const { getActiveLandlordPlan, getPortalSubscriptionMeta, getTenantPlusStatus } =
      await import("@/lib/revenue/subscription-store");
    const { ensureTenantTrial } = await import("@/lib/payments/tenant-trial");
    const { canViewLeadContactDetails } = await import("@/lib/revenue/entitlements");

    const [landlordPlan, plus, trial, portalSub, profileRow, adminRole, listingLimit] = await Promise.all([
      getActiveLandlordPlan(auth.admin, auth.userId),
      getTenantPlusStatus(auth.admin, auth.userId),
      ensureTenantTrial(auth.admin, auth.userId),
      getPortalSubscriptionMeta(auth.admin, auth.userId),
      auth.admin.from("profiles").select("lead_pack_balance, plus_contact_credits").eq("id", auth.userId).maybeSingle(),
      auth.admin
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.userId)
        .eq("role", "admin")
        .maybeSingle(),
      import("@/lib/promo/listing-cap").then(({ getListingCap }) =>
        getListingCap(auth.admin, auth.userId),
      ),
    ]);

    const isAdmin = Boolean(adminRole.data);
    const leadPackBalance = profileRow.data?.lead_pack_balance ?? 0;
    const plusContactCredits = Math.max(
      0,
      Number((profileRow.data as { plus_contact_credits?: number } | null)?.plus_contact_credits) ||
        0,
    );
    const portalSubscriptionStatus = portalSub?.status ?? "none";
    const canViewLeadContacts =
      isAdmin ||
      canViewLeadContactDetails({
        landlordPlan,
        subscriptionStatus: portalSubscriptionStatus,
        leadPackBalance,
      });

    return mobileJson({
      apiVersion: "v1",
      entitlements: {
        landlordPlan: isAdmin ? "agency-enterprise" : landlordPlan,
        tenantPlan: isAdmin ? "plus" : plus.tenantPlan,
        plusExpiresAt: isAdmin ? null : plus.plusExpiresAt,
        trialUnlocksRemaining: trial.trialUnlocksRemaining,
        trialEndsAt: trial.trialEndsAt,
        trialActive: trial.trialActive,
        plusContactCredits: isAdmin ? 9999 : plusContactCredits,
        portalSubscriptionStatus: isAdmin ? "active" : portalSubscriptionStatus,
        portalTrialEndsAt: portalSub?.trialEnd ?? portalSub?.nextBillingDate ?? null,
        leadPackBalance: isAdmin ? Math.max(leadPackBalance, 9999) : leadPackBalance,
        canViewLeadContacts,
        listingLimit: isAdmin ? 9999 : listingLimit,
        isPlus: isAdmin || plus.tenantPlan === "plus",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load entitlements";
    console.error("mobile subscriptions current:", message);
    return mobileError(message, "SUBSCRIPTIONS_ERROR", 500);
  }
}

// ── Tenancy invite ───────────────────────────────────────────────────────────

async function handleInvitePreview(token: string): Promise<Response> {
  try {
    const { readPmTenantInvite } = await import("@/lib/pm/invite-store");
    const { asPmDb } = await import("@/lib/pm/access");

    const invite = await readPmTenantInvite(token);
    if (!invite) {
      return mobileJson({ apiVersion: "v1", valid: false });
    }

    const admin = asPmDb((await import("@/integrations/supabase/client.server")).supabaseAdmin);
    const { data: tenant } = await admin
      .from("pm_tenants")
      .select("id, full_name, email, portal_status, property_id")
      .eq("id", invite.tenantId)
      .maybeSingle();
    if (!tenant) {
      return mobileJson({ apiVersion: "v1", valid: false });
    }

    const { data: property } = await admin
      .from("pm_properties")
      .select("name, neighborhood")
      .eq("id", tenant.property_id)
      .maybeSingle();

    return mobileJson({
      apiVersion: "v1",
      valid: true,
      tenantName: tenant.full_name as string,
      propertyName: (property?.name as string) ?? "Property",
      neighborhood: (property?.neighborhood as string) ?? "",
      portalStatus: tenant.portal_status as string,
      hasExistingAccount: Boolean(invite.existingUserId),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load invitation";
    console.error("mobile invite preview:", message);
    return mobileError(message, "INVITE_ERROR", 500);
  }
}

async function handleInviteRespond(req: Request, token: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ accept?: unknown }>(req);
  if (body instanceof Response) return body;
  if (typeof body.accept !== "boolean") {
    return mobileError("accept must be a boolean", "BAD_REQUEST", 400);
  }

  try {
    const { readPmTenantInvite, deletePmTenantInvite } = await import("@/lib/pm/invite-store");
    const { asPmDb } = await import("@/lib/pm/access");

    const invite = await readPmTenantInvite(token);
    if (!invite) {
      return mobileError("Invitation expired or invalid", "INVITE_INVALID", 404);
    }

    const admin = asPmDb(auth.admin);
    const { data: tenantRow } = await admin
      .from("pm_tenants")
      .select("id, deleted_at, portal_status")
      .eq("id", invite.tenantId)
      .maybeSingle();
    if (!tenantRow || tenantRow.deleted_at) {
      return mobileError("This tenancy invitation is no longer available", "INVITE_INVALID", 404);
    }

    if (!body.accept) {
      await admin
        .from("pm_tenants")
        .update({ portal_status: "declined" })
        .eq("id", invite.tenantId);
      await deletePmTenantInvite(token);
      return mobileJson({ apiVersion: "v1", success: true, status: "declined" });
    }

    if (invite.existingUserId && invite.existingUserId !== auth.userId) {
      return mobileError(
        "Sign in with the invited account to accept this invitation",
        "INVITE_ACCOUNT_MISMATCH",
        403,
      );
    }

    await admin
      .from("pm_tenants")
      .update({
        portal_status: "accepted",
        tenant_user_id: auth.userId,
      })
      .eq("id", invite.tenantId)
      .is("deleted_at", null);
    await deletePmTenantInvite(token);

    const { seedInvoicesForTenantIds } = await import("@/lib/pm/invoice-seed");
    await seedInvoicesForTenantIds(admin, [invite.tenantId]);

    return mobileJson({ apiVersion: "v1", success: true, status: "accepted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not respond to invitation";
    console.error("mobile invite respond:", message);
    return mobileError(message, "INVITE_ERROR", 500);
  }
}

// ── Notification preferences ─────────────────────────────────────────────────

async function handleGetNotificationPrefs(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  try {
    const { getOrCreateNotificationPreferences } = await import("@/lib/notifications/notify-user");
    const prefs = await getOrCreateNotificationPreferences(auth.admin, auth.userId);
    return mobileJson({ apiVersion: "v1", preferences: prefs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load preferences";
    console.error("mobile notification prefs get:", message);
    return mobileError(message, "PREFS_ERROR", 500);
  }
}

async function handlePatchNotificationPrefs(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<Partial<Record<keyof NotificationPreferences, unknown>>>(req);
  if (body instanceof Response) return body;

  try {
    const { getOrCreateNotificationPreferences } = await import("@/lib/notifications/notify-user");
    await getOrCreateNotificationPreferences(auth.admin, auth.userId);

    const patch: Partial<NotificationPreferences> & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    for (const key of PREF_KEYS) {
      if (typeof body[key] === "boolean") patch[key] = body[key] as boolean;
    }

    if (Object.keys(patch).length <= 1) {
      return mobileError("No preference fields to update", "BAD_REQUEST", 400);
    }

    const { data: row, error } = await auth.admin
      .from("notification_preferences")
      .update(patch)
      .eq("user_id", auth.userId)
      .select("*")
      .single();

    if (error) {
      console.error("mobile notification prefs patch:", error.message);
      return mobileError("Could not update preferences", "PREFS_ERROR", 500);
    }

    return mobileJson({
      apiVersion: "v1",
      preferences: {
        announcements: row.announcements,
        listings: row.listings,
        messages: row.messages,
        maintenance: row.maintenance,
        payments: row.payments,
        account: row.account,
        push_enabled: row.push_enabled,
      } satisfies NotificationPreferences,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update preferences";
    console.error("mobile notification prefs patch:", message);
    return mobileError(message, "PREFS_ERROR", 500);
  }
}

// ── Profile patch ────────────────────────────────────────────────────────────

type ProfilePatchBody = {
  full_name?: unknown;
  phone?: unknown;
  avatar_url?: unknown;
};

type ProfilePatch = {
  full_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
  updated_at: string;
};

function applyFullNamePatch(body: ProfilePatchBody, patch: ProfilePatch): Response | null {
  if (!("full_name" in body)) return null;
  if (typeof body.full_name !== "string") {
    return mobileError("full_name must be a string", "BAD_REQUEST", 400);
  }
  const name = body.full_name.trim();
  if (name.length < 2 || name.length > 120) {
    return mobileError("full_name must be 2–120 characters", "BAD_REQUEST", 400);
  }
  patch.full_name = name;
  return null;
}

function applyPhonePatch(body: ProfilePatchBody, patch: ProfilePatch): Response | null {
  if (!("phone" in body)) return null;
  if (body.phone === null || body.phone === "") {
    patch.phone = null;
    return null;
  }
  if (typeof body.phone !== "string") {
    return mobileError("phone must be a string", "BAD_REQUEST", 400);
  }
  const phone = body.phone.trim();
  if (phone.length > 20) {
    return mobileError("phone is too long", "BAD_REQUEST", 400);
  }
  patch.phone = phone;
  return null;
}

function applyAvatarUrlPatch(body: ProfilePatchBody, patch: ProfilePatch): Response | null {
  if (!("avatar_url" in body)) return null;
  if (body.avatar_url === null || body.avatar_url === "") {
    patch.avatar_url = null;
    return null;
  }
  if (typeof body.avatar_url !== "string") {
    return mobileError("avatar_url must be a string", "BAD_REQUEST", 400);
  }
  const url = body.avatar_url.trim();
  if (url.length > 500 || !/^https?:\/\//i.test(url)) {
    return mobileError("avatar_url must be an http(s) URL", "BAD_REQUEST", 400);
  }
  patch.avatar_url = url;
  return null;
}

function buildProfilePatch(body: ProfilePatchBody): ProfilePatch | Response {
  const patch: ProfilePatch = { updated_at: new Date().toISOString() };
  const nameErr = applyFullNamePatch(body, patch);
  if (nameErr) return nameErr;
  const phoneErr = applyPhonePatch(body, patch);
  if (phoneErr) return phoneErr;
  const avatarErr = applyAvatarUrlPatch(body, patch);
  if (avatarErr) return avatarErr;
  if (Object.keys(patch).length <= 1) {
    return mobileError("No profile fields to update", "BAD_REQUEST", 400);
  }
  return patch;
}

async function handlePatchProfile(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<ProfilePatchBody>(req);
  if (body instanceof Response) return body;

  const patch = buildProfilePatch(body);
  if (patch instanceof Response) return patch;

  const { data: row, error } = await auth.admin
    .from("profiles")
    .update(patch)
    .eq("id", auth.userId)
    .select(
      "id, full_name, phone, active_portal, is_portal_active, avatar_url, trial_unlocks_remaining, trial_ends_at",
    )
    .single();

  if (error) {
    console.error("mobile profile patch:", error.message);
    return mobileError("Could not update profile", "PROFILE_ERROR", 500);
  }

  return mobileJson({ apiVersion: "v1", profile: row });
}

/**
 * Wave 8 Mobile BFF — entitlements, tenancy invites, notification prefs, profile edit.
 */
export async function tryHandleWave8(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const exact: Record<string, (r: Request) => Promise<Response>> = {
    "GET /subscriptions/current": handleSubscriptionsCurrent,
    "GET /notifications/prefs": handleGetNotificationPrefs,
    "PATCH /notifications/prefs": handlePatchNotificationPrefs,
    "PATCH /me/profile": handlePatchProfile,
  };

  const exactHandler = exact[`${method} ${rest}`];
  if (exactHandler) return exactHandler(req);

  const inviteMatch = /^\/tenants\/invites\/([^/]+)$/.exec(rest);
  if (inviteMatch) {
    const token = parseUuid(inviteMatch[1]);
    if (!token) return mobileError("Invalid invite token", "BAD_REQUEST", 400);
    if (method === "GET") return handleInvitePreview(token);
    if (method === "POST") return handleInviteRespond(req, token);
  }

  return null;
}
