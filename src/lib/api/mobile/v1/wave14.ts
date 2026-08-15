import type { Database } from "@/integrations/supabase/types";
import {
  mobileError,
  mobileJson,
  requireMobileBearer,
  userHasRole,
  type MobileAdmin,
} from "@/lib/api/mobile/v1/auth";
import { parseJsonBody, parseUuid, requireAdmin } from "@/lib/api/mobile/v1/helpers";
import {
  RATE_LIMITS,
  checkRateLimit,
  rateLimitDistributed,
  rateLimitKeyFromHeaders,
} from "@/lib/api/rate-limit";

type AppRole = Database["public"]["Enums"]["app_role"];

type OrgMemberRole = "owner" | "member" | "pending";

function normalizeOrgRole(role: string): OrgMemberRole {
  if (role === "owner") return "owner";
  if (role === "pending") return "pending";
  return "member";
}

async function findAuthUserByEmail(admin: MobileAdmin, email: string) {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = (data.users ?? []).find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match;
    if ((data.users ?? []).length < perPage) break;
    page += 1;
  }
  return null;
}

async function requireAgencyOrManager(
  admin: MobileAdmin,
  userId: string,
): Promise<Response | null> {
  if (await userHasRole(admin, userId, "agency" as AppRole)) return null;
  if (await userHasRole(admin, userId, "manager" as AppRole)) return null;
  return mobileError("Agency or manager role required", "FORBIDDEN", 403);
}

async function getOrgIdForUser(admin: MobileAdmin, userId: string): Promise<string | null> {
  const { data } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.organization_id ?? null;
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "org"
  );
}

async function ensureOrgForOwner(admin: MobileAdmin, userId: string): Promise<string> {
  const existing = await getOrgIdForUser(admin, userId);
  if (existing) return existing;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const roles = new Set((roleRows ?? []).map((r) => r.role));
  const isManager = roles.has("manager");
  const orgType = isManager ? "property_manager" : "agency";
  const displayName = profile?.full_name?.trim();
  let orgName: string;
  if (displayName) {
    orgName = `${displayName}${isManager ? " Property Management" : " Agency"}`;
  } else if (isManager) {
    orgName = "My Property Management";
  } else {
    orgName = "My Agency";
  }
  const slug = `${slugify(orgName)}-${userId.slice(0, 8)}`;

  const { data: org, error } = await admin
    .from("organizations")
    .insert({ name: orgName, slug, type: orgType })
    .select("id")
    .single();
  if (error || !org) throw new Error(error?.message ?? "Could not create organization");

  const { error: memberError } = await admin.from("organization_members").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  });
  if (memberError) throw memberError;
  return org.id;
}

async function assertOrgOwner(admin: MobileAdmin, userId: string): Promise<string> {
  const orgId = await ensureOrgForOwner(admin, userId);
  const { data: membership } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (normalizeOrgRole(membership?.role ?? "") !== "owner") {
    throw new Error("Only the organization owner can manage the team");
  }
  return orgId;
}

// ── Password reset OTP ───────────────────────────────────────────────────────

async function handlePasswordResetRequest(req: Request): Promise<Response> {
  const body = await parseJsonBody<{ email?: string }>(req);
  if (body instanceof Response) return body;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email.includes("@")) return mobileError("email is required", "BAD_REQUEST", 400);

  const ip = rateLimitKeyFromHeaders(req.headers);
  try {
    checkRateLimit(`pwreset:ip:${ip}`, RATE_LIMITS.passwordReset);
    checkRateLimit(`pwreset:email:${email}`, RATE_LIMITS.passwordReset);
  } catch {
    return mobileError("Too many requests. Try again shortly.", "RATE_LIMITED", 429);
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await findAuthUserByEmail(supabaseAdmin as unknown as MobileAdmin, email);
    // Always return ok to avoid email enumeration.
    if (user) {
      const { generateSixDigitResetCode, storePasswordResetCode } =
        await import("@/lib/auth/password-reset-store");
      const { passwordResetEmail } = await import("@/lib/email/templates");
      const { sendEmailResult } = await import("@/lib/email/send");
      const { getSiteUrl } = await import("@/lib/site");

      const otpCode = generateSixDigitResetCode();
      await storePasswordResetCode({ email, userId: user.id, code: otpCode });
      const resetLink = `${getSiteUrl()}/auth/reset?email=${encodeURIComponent(email)}`;
      const tpl = passwordResetEmail({ resetLink, otpCode });
      await sendEmailResult({ to: email, templateId: "password-reset", ...tpl });
    }
  } catch (err) {
    console.error("[mobile] password reset request:", err);
  }

  return mobileJson({ apiVersion: "v1", ok: true });
}

async function assertResetOtpAllowed(req: Request, email: string): Promise<Response | null> {
  const ip = rateLimitKeyFromHeaders(req.headers);
  const [byEmail, byIp] = await Promise.all([
    rateLimitDistributed(`pwreset-verify:email:${email}`, RATE_LIMITS.passwordResetVerify),
    rateLimitDistributed(`pwreset-verify:ip:${ip}`, RATE_LIMITS.passwordResetVerify),
  ]);
  if (byEmail.limited || byIp.limited) {
    return mobileError(
      "Too many attempts. Request a new reset code and try again shortly.",
      "RATE_LIMITED",
      429,
    );
  }
  return null;
}

async function handlePasswordResetVerify(req: Request): Promise<Response> {
  const body = await parseJsonBody<{ email?: string; code?: string }>(req);
  if (body instanceof Response) return body;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!email.includes("@") || !/^\d{6}$/.test(code)) {
    return mobileError("email and 6-digit code required", "BAD_REQUEST", 400);
  }

  const limited = await assertResetOtpAllowed(req, email);
  if (limited) return limited;

  try {
    const { consumeResetAttempt, markPasswordResetVerified } =
      await import("@/lib/auth/password-reset-store");
    const attempt = await consumeResetAttempt(email, code);
    if (!attempt.ok) {
      return mobileError("Invalid or expired reset code. Request a new code.", "BAD_REQUEST", 400);
    }
    await markPasswordResetVerified(email);
    return mobileJson({ apiVersion: "v1", ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not verify code";
    return mobileError(message, "AUTH_ERROR", 400);
  }
}

async function handlePasswordResetComplete(req: Request): Promise<Response> {
  const body = await parseJsonBody<{ email?: string; code?: string; password?: string }>(req);
  if (body instanceof Response) return body;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email.includes("@") || !/^\d{6}$/.test(code)) {
    return mobileError("email and 6-digit code required", "BAD_REQUEST", 400);
  }
  if (password.length < 8 || password.length > 72) {
    return mobileError("password must be 8–72 characters", "BAD_REQUEST", 400);
  }

  const limited = await assertResetOtpAllowed(req, email);
  if (limited) return limited;

  try {
    const { consumeResetAttempt, consumePasswordReset } =
      await import("@/lib/auth/password-reset-store");
    const attempt = await consumeResetAttempt(email, code);
    if (!attempt.ok) {
      return mobileError("Invalid or expired reset code. Request a new code.", "BAD_REQUEST", 400);
    }
    if (!attempt.record.verified) {
      return mobileError(
        "Verify the 6-digit code before setting a new password.",
        "BAD_REQUEST",
        400,
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(attempt.record.userId, {
      password,
    });
    if (error) return mobileError(error.message, "AUTH_ERROR", 400);

    await consumePasswordReset(email);
    return mobileJson({ apiVersion: "v1", ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reset password";
    return mobileError(message, "AUTH_ERROR", 400);
  }
}

// ── Org membership / team ────────────────────────────────────────────────────

async function handleOrgMembership(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const hasAgency = await userHasRole(auth.admin, auth.userId, "agency" as AppRole);
  const hasManager = await userHasRole(auth.admin, auth.userId, "manager" as AppRole);
  if (!hasAgency && !hasManager) {
    return mobileJson({ apiVersion: "v1", membership: null });
  }

  const { data: membership } = await auth.admin
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, type)")
    .eq("user_id", auth.userId)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return mobileJson({ apiVersion: "v1", membership: null });
  }

  const org = membership.organizations as
    | { id: string; name: string; type: string }
    | { id: string; name: string; type: string }[]
    | null;
  const organization = Array.isArray(org) ? org[0] : org;
  if (!organization) {
    return mobileJson({ apiVersion: "v1", membership: null });
  }

  const role = normalizeOrgRole(membership.role);
  return mobileJson({
    apiVersion: "v1",
    membership: {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationType: organization.type,
      role,
      isOwner: role === "owner",
      isMember: role === "member",
      isPending: role === "pending",
    },
  });
}

async function handleListOrgTeam(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requireAgencyOrManager(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const orgId = await getOrgIdForUser(auth.admin, auth.userId);
  if (!orgId) return mobileJson({ apiVersion: "v1", members: [] });

  const { data: members, error } = await auth.admin
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (error) return mobileError(error.message, "ORG_ERROR", 400);
  if (!members?.length) return mobileJson({ apiVersion: "v1", members: [] });

  const userIds = members.map((m) => m.user_id);
  const [{ data: profiles }, authUsers] = await Promise.all([
    auth.admin.from("profiles").select("id, full_name, phone").in("id", userIds),
    Promise.all(userIds.map((id) => auth.admin.auth.admin.getUserById(id))),
  ]);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const emailMap = new Map(
    authUsers.map((r, i) => [userIds[i], r.data.user?.email ?? null] as const),
  );

  return mobileJson({
    apiVersion: "v1",
    members: members.map((m) => ({
      userId: m.user_id,
      role: normalizeOrgRole(m.role),
      createdAt: m.created_at,
      profile: profileMap.get(m.user_id) ?? null,
      email: emailMap.get(m.user_id) ?? null,
    })),
  });
}

async function resolveOrCreateInvitee(
  admin: MobileAdmin,
  email: string,
  inviteeName: string,
): Promise<{ invitee: { id: string }; isNewAccount: boolean } | Response> {
  let invitee = await findAuthUserByEmail(admin, email);
  const isNewAccount = !invitee;

  if (!invitee) {
    const password = `${crypto.randomUUID()}Aa1!`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: inviteeName, source: "org_team_invite" },
    });
    if (error || !created.user) {
      return mobileError(error?.message ?? "Could not create invitee", "ORG_ERROR", 400);
    }
    invitee = created.user;
    await admin.from("profiles").upsert({ id: invitee.id, full_name: inviteeName });
  }

  return { invitee, isNewAccount };
}

async function upsertPendingOrgMember(
  admin: MobileAdmin,
  orgId: string,
  inviteeId: string,
): Promise<Response | null> {
  const { data: existing } = await admin
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", orgId)
    .eq("user_id", inviteeId)
    .maybeSingle();

  if (existing) {
    if (normalizeOrgRole(existing.role) === "owner") {
      return mobileError("This user is already the owner", "BAD_REQUEST", 400);
    }
    await admin.from("organization_members").update({ role: "pending" }).eq("id", existing.id);
    return null;
  }

  const { error } = await admin.from("organization_members").insert({
    organization_id: orgId,
    user_id: inviteeId,
    role: "pending",
  });
  if (error) return mobileError(error.message, "ORG_ERROR", 400);
  return null;
}

async function ensureInviteePortalRoles(
  admin: MobileAdmin,
  inviteeId: string,
  orgType: string | undefined,
): Promise<void> {
  const portalRole = orgType === "property_manager" ? "manager" : "agency";
  await admin
    .from("user_roles")
    .upsert(
      { user_id: inviteeId, role: portalRole },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
  await admin
    .from("user_roles")
    .upsert(
      { user_id: inviteeId, role: "tenant" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
}

async function sendOrgTeamInviteNotify(params: {
  admin: MobileAdmin;
  ownerUserId: string;
  email: string;
  inviteeName: string;
  inviteeId: string;
  org: { type: string; name: string } | null;
  isNewAccount: boolean;
}): Promise<void> {
  try {
    const { notifyOrgTeamInvited } = await import("@/lib/api/notify");
    const { getSiteUrl } = await import("@/lib/site");
    const [{ data: inviterProfile }, inviterAuth] = await Promise.all([
      params.admin.from("profiles").select("full_name").eq("id", params.ownerUserId).maybeSingle(),
      params.admin.auth.admin.getUserById(params.ownerUserId),
    ]);
    let setupPasswordUrl: string | undefined;
    let otpCode: string | undefined;
    if (params.isNewAccount) {
      const { generateSixDigitResetCode, storePasswordResetCode } =
        await import("@/lib/auth/password-reset-store");
      otpCode = generateSixDigitResetCode();
      await storePasswordResetCode({
        email: params.email,
        userId: params.inviteeId,
        code: otpCode,
      });
      setupPasswordUrl = `${getSiteUrl()}/auth/reset?email=${encodeURIComponent(params.email)}`;
    }
    await notifyOrgTeamInvited({
      email: params.email,
      inviteeName: params.inviteeName,
      inviterName:
        inviterProfile?.full_name?.trim() ||
        inviterAuth.data.user?.email?.split("@")[0] ||
        "Your team owner",
      organizationName: params.org?.name ?? "your organization",
      portalLabel: params.org?.type === "property_manager" ? "property manager" : "agency",
      signInUrl: `${getSiteUrl()}/auth`,
      isNewAccount: params.isNewAccount,
      setupPasswordUrl,
      otpCode,
      userId: params.inviteeId,
    });
  } catch (err) {
    console.warn("[mobile org team] invite notify failed", err);
  }
}

async function handleInviteOrgTeam(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requireAgencyOrManager(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<{ email?: string; fullName?: string }>(req);
  if (body instanceof Response) return body;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email.includes("@")) return mobileError("email is required", "BAD_REQUEST", 400);
  const inviteeName =
    typeof body.fullName === "string" && body.fullName.trim().length >= 2
      ? body.fullName.trim()
      : email.split("@")[0];

  try {
    const orgId = await assertOrgOwner(auth.admin, auth.userId);
    const resolved = await resolveOrCreateInvitee(auth.admin, email, inviteeName);
    if (resolved instanceof Response) return resolved;
    const { invitee, isNewAccount } = resolved;

    if (invitee.id === auth.userId) {
      return mobileError("You are already the organization owner", "BAD_REQUEST", 400);
    }

    const memberErr = await upsertPendingOrgMember(auth.admin, orgId, invitee.id);
    if (memberErr) return memberErr;

    const { data: org } = await auth.admin
      .from("organizations")
      .select("type, name")
      .eq("id", orgId)
      .maybeSingle();
    await ensureInviteePortalRoles(auth.admin, invitee.id, org?.type);

    await sendOrgTeamInviteNotify({
      admin: auth.admin,
      ownerUserId: auth.userId,
      email,
      inviteeName,
      inviteeId: invitee.id,
      org,
      isNewAccount,
    });

    return mobileJson({ apiVersion: "v1", ok: true, userId: invitee.id, status: "pending" }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not invite member";
    return mobileError(message, "ORG_ERROR", 400);
  }
}

async function handleApproveOrgTeam(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requireAgencyOrManager(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<{ memberUserId?: string }>(req);
  if (body instanceof Response) return body;
  const memberUserId = typeof body.memberUserId === "string" ? parseUuid(body.memberUserId) : null;
  if (!memberUserId) return mobileError("memberUserId required", "BAD_REQUEST", 400);

  try {
    const orgId = await assertOrgOwner(auth.admin, auth.userId);
    const { data: row, error } = await auth.admin
      .from("organization_members")
      .update({ role: "member" })
      .eq("organization_id", orgId)
      .eq("user_id", memberUserId)
      .eq("role", "pending")
      .select("user_id")
      .maybeSingle();
    if (error) return mobileError(error.message, "ORG_ERROR", 400);
    if (!row) return mobileError("No pending invite found", "NOT_FOUND", 404);

    try {
      const { notifyOrgTeamApproved } = await import("@/lib/api/notify");
      const [{ data: org }, { data: profile }, memberAuth] = await Promise.all([
        auth.admin.from("organizations").select("name, type").eq("id", orgId).maybeSingle(),
        auth.admin.from("profiles").select("full_name").eq("id", memberUserId).maybeSingle(),
        auth.admin.auth.admin.getUserById(memberUserId),
      ]);
      const memberEmail = memberAuth.data.user?.email;
      if (memberEmail && org?.type) {
        await notifyOrgTeamApproved({
          email: memberEmail,
          inviteeName: profile?.full_name?.trim() || memberEmail.split("@")[0],
          organizationName: org.name,
          portalType: org.type as "agency" | "property_manager",
          userId: memberUserId,
        });
      }
    } catch (err) {
      console.warn("[mobile org team] approve notify failed", err);
    }

    return mobileJson({ apiVersion: "v1", ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not approve member";
    return mobileError(message, "ORG_ERROR", 400);
  }
}

async function handleRevokeOrgTeam(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;
  const roleErr = await requireAgencyOrManager(auth.admin, auth.userId);
  if (roleErr) return roleErr;

  const body = await parseJsonBody<{ memberUserId?: string }>(req);
  if (body instanceof Response) return body;
  const memberUserId = typeof body.memberUserId === "string" ? parseUuid(body.memberUserId) : null;
  if (!memberUserId) return mobileError("memberUserId required", "BAD_REQUEST", 400);

  try {
    const orgId = await assertOrgOwner(auth.admin, auth.userId);
    if (memberUserId === auth.userId) {
      return mobileError("You cannot remove yourself as owner", "BAD_REQUEST", 400);
    }
    const { error } = await auth.admin
      .from("organization_members")
      .delete()
      .eq("organization_id", orgId)
      .eq("user_id", memberUserId)
      .neq("role", "owner");
    if (error) return mobileError(error.message, "ORG_ERROR", 400);
    return mobileJson({ apiVersion: "v1", ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not revoke member";
    return mobileError(message, "ORG_ERROR", 400);
  }
}

// ── Portal dashboards (agency / manager) ─────────────────────────────────────

async function handlePortalDashboard(
  req: Request,
  portal: "agency" | "manager",
): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  if (!(await userHasRole(auth.admin, auth.userId, portal as AppRole))) {
    return mobileError(`${portal} role required`, "FORBIDDEN", 403);
  }

  const orgId = await getOrgIdForUser(auth.admin, auth.userId);
  let propertiesQuery = auth.admin
    .from("properties")
    .select("id, title, rent_kes, is_active, is_vacant, views, neighborhood, updated_at")
    .limit(300);
  propertiesQuery = orgId
    ? propertiesQuery.eq("organization_id", orgId)
    : propertiesQuery.eq("owner_id", auth.userId);

  const [{ data: properties, error: propertiesError }, { data: leads, error: leadsError }] =
    await Promise.all([
      propertiesQuery,
      auth.admin
        .from("inquiries")
        .select("id, status, created_at, property_id, message")
        .eq("landlord_id", auth.userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (propertiesError) {
    console.error(`mobile ${portal} dashboard properties:`, propertiesError.message);
    return mobileError("Could not load dashboard", "DASHBOARD_ERROR", 500);
  }
  if (leadsError) {
    console.error(`mobile ${portal} dashboard leads:`, leadsError.message);
    return mobileError("Could not load dashboard", "DASHBOARD_ERROR", 500);
  }

  const propertyRows = properties ?? [];
  const leadRows = leads ?? [];
  const activeProperties = propertyRows.filter((p) => p.is_active);
  const totalViews = propertyRows.reduce((sum, p) => sum + (p.views ?? 0), 0);
  const potentialRevenue = activeProperties.reduce((sum, p) => sum + (p.rent_kes ?? 0), 0);

  return mobileJson({
    apiVersion: "v1",
    portal,
    organizationId: orgId,
    stats: {
      totalProperties: propertyRows.length,
      activeProperties: activeProperties.length,
      vacantProperties: propertyRows.filter((p) => p.is_vacant).length,
      totalViews,
      totalLeads: leadRows.length,
      newLeads: leadRows.filter((lead) => lead.status === "new").length,
      potentialRevenue,
    },
    recentLeads: leadRows.slice(0, 10),
    properties: propertyRows.slice(0, 20),
  });
}

// ── Referrals ────────────────────────────────────────────────────────────────

async function handleReferralsMe(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  try {
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const { ensureReferralCode } = await import("@/lib/referrals/generate-code");
    const db = asLooseDb(auth.admin);
    const referralCode = await ensureReferralCode(auth.admin, auth.userId);

    const { data: referrals } = await db
      .from("referrals")
      .select("id, referred_user_id, referred_role_at_referral, status, converted_at, created_at")
      .eq("referrer_user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    type ReferralRow = {
      id: string;
      referred_user_id: string;
      referred_role_at_referral: string | null;
      status: string;
      converted_at: string | null;
      created_at: string;
    };
    const rows = (referrals ?? []) as ReferralRow[];
    const referredUserIds = rows.map((r) => r.referred_user_id);
    const nameMap: Record<string, string> = {};
    if (referredUserIds.length > 0) {
      const { data: profiles } = await auth.admin
        .from("profiles")
        .select("id, full_name")
        .in("id", referredUserIds);
      for (const p of profiles ?? []) {
        nameMap[p.id] = p.full_name ?? "User";
      }
    }

    const pendingCount = rows.filter((r) => r.status === "pending").length;
    const convertedCount = rows.filter((r) => r.status === "converted").length;

    const { data: rewards } = await db
      .from("referral_reward_ledger")
      .select("reward_type, reward_value")
      .eq("user_id", auth.userId);

    type RewardRow = { reward_type: string; reward_value: number };
    const rewardSummary: Record<string, number> = {};
    for (const r of (rewards ?? []) as RewardRow[]) {
      rewardSummary[r.reward_type] = (rewardSummary[r.reward_type] ?? 0) + r.reward_value;
    }

    const parts: string[] = [];
    if (rewardSummary.unlock_credit) parts.push(`${rewardSummary.unlock_credit} unlock credits`);
    if (rewardSummary.listing_slot_bonus)
      parts.push(`${rewardSummary.listing_slot_bonus} bonus slots`);
    if (rewardSummary.cash_credit_kes) parts.push(`KES ${rewardSummary.cash_credit_kes}`);
    if (rewardSummary.free_month_extension)
      parts.push(`${rewardSummary.free_month_extension} free months`);
    if (rewardSummary.subscription_discount_percent)
      parts.push(`${rewardSummary.subscription_discount_percent}% discount`);
    if (rewardSummary.trial_extension_days)
      parts.push(`${rewardSummary.trial_extension_days} trial days`);

    return mobileJson({
      apiVersion: "v1",
      referralCode,
      pendingCount,
      convertedCount,
      totalRewardsSummary: parts.join(", ") || "—",
      referrals: rows.map((r) => ({
        id: r.id,
        referredName: nameMap[r.referred_user_id] ?? "User",
        referredRole: r.referred_role_at_referral ?? "member",
        status: r.status,
        convertedAt: r.converted_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load referrals";
    return mobileError(message, "REFERRAL_ERROR", 500);
  }
}

async function handleResolveReferral(req: Request): Promise<Response> {
  const body = await parseJsonBody<{ code?: string }>(req);
  if (body instanceof Response) return body;
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) return mobileError("code is required", "BAD_REQUEST", 400);

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const { data: profile } = await asLooseDb(supabaseAdmin)
      .from("profiles")
      .select("id, full_name, referral_code")
      .eq("referral_code", code)
      .maybeSingle();

    if (!profile) {
      return mobileJson({ apiVersion: "v1", valid: false });
    }
    return mobileJson({
      apiVersion: "v1",
      valid: true,
      referrerName: (profile as { full_name: string | null }).full_name ?? "NyumbaSearch user",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not resolve code";
    return mobileError(message, "REFERRAL_ERROR", 500);
  }
}

// ── Admin PM oversight ───────────────────────────────────────────────────────

async function handleAdminPmOverview(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  try {
    const { asPmDb } = await import("@/lib/pm/access");
    const admin = asPmDb(auth.admin);

    const { data: subRows, error: subErr } = await admin
      .from("subscriptions")
      .select(
        "id, user_id, plan, status, amount_kes, trial_end, next_billing_date, created_at, module",
      )
      .eq("module", "property_management")
      .order("created_at", { ascending: false })
      .limit(100);
    if (subErr) throw subErr;

    const { data: disputeRows, error: disputeErr } = await admin
      .from("admin_dispute_queue")
      .select("id, related_id, reason, status, created_at")
      .eq("dispute_type", "rent_payment_claim")
      .eq("status", "open")
      .order("created_at", { ascending: true });
    if (disputeErr) throw disputeErr;

    const { data: reversalRows, error: revErr } = await admin
      .from("pm_rent_payments")
      .select("id, amount, reversal_reason, paid_at, reversal_of_payment_id")
      .eq("is_reversal", true)
      .order("paid_at", { ascending: false })
      .limit(50);
    if (revErr) throw revErr;

    const userIds = [...new Set((subRows ?? []).map((s) => s.user_id))];
    const nameById: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await auth.admin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        nameById[p.id] = p.full_name ?? null;
      }
    }

    const claimIds = (disputeRows ?? []).map((d) => d.related_id);
    const claimById: Record<
      string,
      {
        id: string;
        amountClaimed: number;
        method: string;
        paidOnDate: string;
        note: string | null;
      }
    > = {};
    if (claimIds.length > 0) {
      const { data: claims } = await admin
        .from("pm_rent_payment_claims")
        .select("id, amount_claimed, method, paid_on_date, note")
        .in("id", claimIds);
      for (const c of claims ?? []) {
        claimById[c.id] = {
          id: c.id,
          amountClaimed: Number(c.amount_claimed),
          method: String(c.method),
          paidOnDate: String(c.paid_on_date),
          note: c.note ?? null,
        };
      }
    }

    return mobileJson({
      apiVersion: "v1",
      activePmSubscriptions: (subRows ?? []).map((s) => ({
        id: s.id,
        userId: s.user_id,
        plan: s.plan,
        status: s.status,
        amountKes: s.amount_kes,
        trialEnd: s.trial_end,
        nextBillingDate: s.next_billing_date,
        createdAt: s.created_at,
        fullName: nameById[s.user_id] ?? null,
      })),
      openDisputes: (disputeRows ?? []).map((d) => ({
        id: d.id,
        relatedId: d.related_id,
        reason: d.reason,
        claim: claimById[d.related_id] ?? null,
      })),
      recentReversals: (reversalRows ?? []).map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        reversalReason: r.reversal_reason,
        paidAt: r.paid_at,
        reversalOfPaymentId: r.reversal_of_payment_id,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load PM admin overview";
    return mobileError(message, "ADMIN_ERROR", 500);
  }
}

type PmAdmin = import("@/lib/pm/access").PmDb;

async function resolvePropertyForClaim(
  admin: PmAdmin,
  invoiceId: string,
): Promise<{ id: string; owner_user_id: string } | null> {
  const { data: invoice } = await admin
    .from("pm_rent_invoices")
    .select("lease_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return null;

  const { data: lease } = await admin
    .from("pm_leases")
    .select("unit_id")
    .eq("id", invoice.lease_id)
    .maybeSingle();
  if (!lease) return null;

  const { data: unit } = await admin
    .from("pm_units")
    .select("property_id")
    .eq("id", lease.unit_id)
    .maybeSingle();
  if (!unit) return null;

  const { data: prop } = await admin
    .from("pm_properties")
    .select("id, owner_user_id")
    .eq("id", unit.property_id)
    .maybeSingle();
  return prop ?? null;
}

async function upholdTenantClaim(params: {
  admin: PmAdmin;
  claim: {
    id: string;
    invoice_id: string;
    amount_claimed: number;
  };
  userId: string;
  notes: string;
}): Promise<void> {
  const { recordFeeAndDisburse } = await import("@/lib/pm/fee-and-payout");
  const { recomputeInvoiceStatus } = await import("@/lib/pm/invoice-integrity");
  const property = await resolvePropertyForClaim(params.admin, params.claim.invoice_id);

  const { data: payRow, error: payErr } = await params.admin
    .from("pm_rent_payments")
    .insert({
      invoice_id: params.claim.invoice_id,
      amount: params.claim.amount_claimed,
      method: "manual",
      recorded_by_user_id: params.userId,
      source_claim_id: params.claim.id,
      note: `Admin-resolved dispute in tenant's favour: ${params.notes}`,
    })
    .select("id")
    .single();
  if (payErr) throw payErr;

  if (property) {
    await recordFeeAndDisburse(params.admin, {
      rentPaymentId: payRow.id,
      ownerUserId: property.owner_user_id,
      propertyId: property.id,
      grossAmount: Number(params.claim.amount_claimed),
    });
  }
  await recomputeInvoiceStatus(params.admin, params.claim.invoice_id);
  await params.admin
    .from("pm_rent_payment_claims")
    .update({
      status: "confirmed",
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: params.userId,
    })
    .eq("id", params.claim.id);
}

async function upholdLandlordClaim(admin: PmAdmin, claimId: string, userId: string): Promise<void> {
  await admin
    .from("pm_rent_payment_claims")
    .update({
      status: "disputed",
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: userId,
    })
    .eq("id", claimId);
}

async function finalizeDisputeResolution(params: {
  admin: PmAdmin;
  authAdmin: MobileAdmin;
  disputeId: string;
  claimId: string;
  userId: string;
  outcome: string;
  notes: string;
}): Promise<void> {
  await params.admin
    .from("admin_dispute_queue")
    .update({
      status: "resolved",
      resolution_outcome: params.outcome,
      resolution_notes: params.notes,
      resolved_by_user_id: params.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", params.disputeId);

  await params.authAdmin.from("admin_audit_logs").insert({
    admin_id: params.userId,
    action: "pm_dispute_resolve",
    target_id: params.disputeId,
    details: JSON.stringify({
      outcome: params.outcome,
      notes: params.notes,
      claimId: params.claimId,
    }),
  });
}

async function handleResolvePmDispute(req: Request, disputeId: string): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{ outcome?: string; notes?: string }>(req);
  if (body instanceof Response) return body;
  const outcome = body.outcome;
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (outcome !== "uphold_tenant" && outcome !== "uphold_landlord") {
    return mobileError("outcome must be uphold_tenant|uphold_landlord", "BAD_REQUEST", 400);
  }
  if (notes.length < 3) return mobileError("notes required (min 3 chars)", "BAD_REQUEST", 400);

  try {
    const { asPmDb } = await import("@/lib/pm/access");
    const admin = asPmDb(auth.admin);

    const { data: dispute } = await admin
      .from("admin_dispute_queue")
      .select("*")
      .eq("id", disputeId)
      .maybeSingle();
    if (!dispute) return mobileError("Dispute not found", "NOT_FOUND", 404);
    if (dispute.status !== "open") {
      return mobileError("Dispute already resolved", "BAD_REQUEST", 400);
    }

    const { data: claim } = await admin
      .from("pm_rent_payment_claims")
      .select("*")
      .eq("id", dispute.related_id)
      .maybeSingle();
    if (!claim) return mobileError("Related claim not found", "NOT_FOUND", 404);

    if (outcome === "uphold_tenant") {
      await upholdTenantClaim({
        admin,
        claim: {
          id: claim.id,
          invoice_id: claim.invoice_id,
          amount_claimed: claim.amount_claimed,
        },
        userId: auth.userId,
        notes,
      });
    } else {
      await upholdLandlordClaim(admin, claim.id, auth.userId);
    }

    await finalizeDisputeResolution({
      admin,
      authAdmin: auth.admin,
      disputeId,
      claimId: claim.id,
      userId: auth.userId,
      outcome,
      notes,
    });

    return mobileJson({ apiVersion: "v1", ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not resolve dispute";
    return mobileError(message, "ADMIN_ERROR", 500);
  }
}

function matchUuidParam(rest: string, pattern: RegExp): string | null | undefined {
  const match = pattern.exec(rest);
  if (!match) return undefined;
  return parseUuid(match[1]);
}

/**
 * Wave 14 Mobile BFF — password-reset OTP, org team, portal dashboards, referrals, PM admin.
 */
export async function tryHandleWave14(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const exact: Record<string, (r: Request) => Promise<Response>> = {
    "POST /auth/password-reset/request": handlePasswordResetRequest,
    "POST /auth/password-reset/verify": handlePasswordResetVerify,
    "POST /auth/password-reset/complete": handlePasswordResetComplete,
    "GET /me/org-membership": handleOrgMembership,
    "GET /org/team": handleListOrgTeam,
    "POST /org/team": handleInviteOrgTeam,
    "POST /org/team/approve": handleApproveOrgTeam,
    "POST /org/team/revoke": handleRevokeOrgTeam,
    "GET /agencies/dashboard": (r) => handlePortalDashboard(r, "agency"),
    "GET /managers/dashboard": (r) => handlePortalDashboard(r, "manager"),
    "GET /referrals/me": handleReferralsMe,
    "POST /referrals/resolve": handleResolveReferral,
    "GET /admin/pm/overview": handleAdminPmOverview,
  };

  const exactHandler = exact[`${method} ${rest}`];
  if (exactHandler) return exactHandler(req);

  if (method === "POST") {
    const disputeId = matchUuidParam(rest, /^\/admin\/pm\/disputes\/([^/]+)\/resolve$/);
    if (disputeId === null) return mobileError("Invalid dispute id", "BAD_REQUEST", 400);
    if (disputeId !== undefined) return handleResolvePmDispute(req, disputeId);
  }

  return null;
}
