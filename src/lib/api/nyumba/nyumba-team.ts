import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole, ForbiddenError } from "@/lib/api/_authz";
import { notifyOrgTeamApproved, notifyOrgTeamInvited } from "@/lib/api/notify";
import { getSiteUrl } from "@/lib/site";
import {
  authContext,
  getUserOrganizationId,
  adminClient,
} from "@/lib/api/nyumba/nyumba-shared";

export type OrgMemberRole = "owner" | "member" | "pending";

export type OrgMembership = {
  organizationId: string;
  organizationName: string;
  organizationType: string;
  role: OrgMemberRole;
  isOwner: boolean;
  isMember: boolean;
  isPending: boolean;
};

function normalizeRole(role: string): OrgMemberRole {
  if (role === "owner") return "owner";
  if (role === "pending") return "pending";
  return "member";
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

async function findAuthUserByEmail(email: string) {
  const admin = await adminClient();
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

/** Creates an organization for solo agency/manager owners who don't have one yet. */
async function ensureOrgForOwner(
  supabase: ReturnType<typeof authContext>["supabase"],
  userId: string,
): Promise<string> {
  const existing = await getUserOrganizationId(supabase, userId);
  if (existing) return existing;

  const admin = await adminClient();
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const roles = new Set((roleRows ?? []).map((r) => r.role));
  const isManager = roles.has("manager");
  const orgType = isManager ? "property_manager" : "agency";
  const displayName = profile?.full_name?.trim();
  const orgName = displayName
    ? `${displayName}${isManager ? " Property Management" : " Agency"}`
    : isManager
      ? "My Property Management"
      : "My Agency";
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

async function assertOrgOwner(
  supabase: ReturnType<typeof authContext>["supabase"],
  userId: string,
) {
  const orgId = await ensureOrgForOwner(supabase, userId);

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (normalizeRole(membership?.role ?? "") !== "owner") {
    throw new ForbiddenError("Only the organization owner can manage the team");
  }
  return orgId;
}

async function sendTeamInviteEmail(opts: {
  email: string;
  inviteeName: string;
  inviterUserId: string;
  orgId: string;
  isNewAccount: boolean;
}) {
  const admin = await adminClient();
  const [{ data: org }, { data: inviterProfile }, inviterAuth] = await Promise.all([
    admin.from("organizations").select("name, type").eq("id", opts.orgId).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", opts.inviterUserId).maybeSingle(),
    admin.auth.admin.getUserById(opts.inviterUserId),
  ]);

  const portalLabel = org?.type === "property_manager" ? "property manager" : "agency";
  const signInUrl = `${getSiteUrl()}/auth`;
  let setupPasswordUrl: string | undefined;
  let otpCode: string | undefined;

  if (opts.isNewAccount) {
    const user = await findAuthUserByEmail(opts.email);
    if (user) {
      const { generateSixDigitResetCode, storePasswordResetCode } =
        await import("@/lib/auth/password-reset-store");
      otpCode = generateSixDigitResetCode();
      await storePasswordResetCode({ email: opts.email, userId: user.id, code: otpCode });
      setupPasswordUrl = `${getSiteUrl()}/auth/reset?email=${encodeURIComponent(opts.email)}`;
    }
  }

  const sent = await notifyOrgTeamInvited({
    email: opts.email,
    inviteeName: opts.inviteeName,
    inviterName:
      inviterProfile?.full_name?.trim() ||
      inviterAuth.data.user?.email?.split("@")[0] ||
      "Your team owner",
    organizationName: org?.name ?? "your organization",
    portalLabel,
    signInUrl,
    isNewAccount: opts.isNewAccount,
    setupPasswordUrl,
    otpCode,
  });

  if (!sent) {
    console.warn("[team] invite email failed to send for", opts.email);
  }
}

/** Current user's org membership for agency/manager portals. */
export const getMyOrgMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = new Set((roleRows ?? []).map((r) => r.role));
    if (!roles.has("agency") && !roles.has("manager")) {
      return null as OrgMembership | null;
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(id, name, type)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!membership) return null;

    const org = membership.organizations as
      | { id: string; name: string; type: string }
      | { id: string; name: string; type: string }[]
      | null;
    const organization = Array.isArray(org) ? org[0] : org;
    if (!organization) return null;

    const role = normalizeRole(membership.role);
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationType: organization.type,
      role,
      isOwner: role === "owner",
      isMember: role === "member",
      isPending: role === "pending",
    } satisfies OrgMembership;
  });

export const listOrgTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, ["agency", "manager"]);
    const orgId = await getUserOrganizationId(supabase, userId);
    if (!orgId) return [];

    const { data: members, error } = await supabase
      .from("organization_members")
      .select("user_id, role, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!members?.length) return [];

    const userIds = members.map((m) => m.user_id);
    const admin = await adminClient();
    const [{ data: profiles }, authUsers] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone").in("id", userIds),
      Promise.all(userIds.map((id) => admin.auth.admin.getUserById(id))),
    ]);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const emailMap = new Map(
      authUsers.map((r, i) => [userIds[i], r.data.user?.email ?? null] as const),
    );

    return members.map((m) => ({
      user_id: m.user_id,
      role: normalizeRole(m.role),
      created_at: m.created_at,
      profile: profileMap.get(m.user_id) ?? null,
      email: emailMap.get(m.user_id) ?? null,
    }));
  });

export const inviteOrgTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email(),
      fullName: z.string().trim().min(2).max(120).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, ["agency", "manager"]);
    const orgId = await assertOrgOwner(supabase, userId);

    const email = data.email.trim().toLowerCase();
    const inviteeName = data.fullName?.trim() || email.split("@")[0];
    let invitee = await findAuthUserByEmail(email);
    const admin = await adminClient();
    const isNewAccount = !invitee;

    if (!invitee) {
      const password = `${crypto.randomUUID()}Aa1!`;
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: inviteeName,
          source: "org_team_invite",
        },
      });
      if (error || !created.user) {
        throw new Error(error?.message ?? "Could not create invitee account");
      }
      invitee = created.user;
      await admin.from("profiles").upsert({
        id: invitee.id,
        full_name: inviteeName,
      });
    }

    if (invitee.id === userId) {
      throw new Error("You are already the organization owner");
    }

    const { data: existing } = await admin
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", orgId)
      .eq("user_id", invitee.id)
      .maybeSingle();

    if (existing) {
      if (normalizeRole(existing.role) === "owner") {
        throw new Error("This user is already the owner");
      }
      await admin
        .from("organization_members")
        .update({ role: "pending" })
        .eq("id", existing.id);
    } else {
      const { error } = await admin.from("organization_members").insert({
        organization_id: orgId,
        user_id: invitee.id,
        role: "pending",
      });
      if (error) throw error;
    }

    const { data: org } = await admin
      .from("organizations")
      .select("type")
      .eq("id", orgId)
      .maybeSingle();
    const portalRole = org?.type === "property_manager" ? "manager" : "agency";
    await admin.from("user_roles").upsert(
      { user_id: invitee.id, role: portalRole },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
    await admin.from("user_roles").upsert(
      { user_id: invitee.id, role: "tenant" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

    await sendTeamInviteEmail({
      email,
      inviteeName,
      inviterUserId: userId,
      orgId,
      isNewAccount,
    });

    return { ok: true, userId: invitee.id, status: "pending" as const, emailSent: true };
  });

export const approveOrgTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ memberUserId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, ["agency", "manager"]);
    const orgId = await assertOrgOwner(supabase, userId);
    const admin = await adminClient();

    const { data: row, error } = await admin
      .from("organization_members")
      .update({ role: "member" })
      .eq("organization_id", orgId)
      .eq("user_id", data.memberUserId)
      .eq("role", "pending")
      .select("user_id")
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("No pending invite found for this user");

    const [{ data: org }, { data: profile }, memberAuth] = await Promise.all([
      admin.from("organizations").select("name, type").eq("id", orgId).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", data.memberUserId).maybeSingle(),
      admin.auth.admin.getUserById(data.memberUserId),
    ]);

    const memberEmail = memberAuth.data.user?.email;
    if (memberEmail && org?.type) {
      await notifyOrgTeamApproved({
        email: memberEmail,
        inviteeName: profile?.full_name?.trim() || memberEmail.split("@")[0],
        organizationName: org.name,
        portalType: org.type as "agency" | "property_manager",
      });
    }

    return { ok: true };
  });

export const revokeOrgTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ memberUserId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, ["agency", "manager"]);
    const orgId = await assertOrgOwner(supabase, userId);
    if (data.memberUserId === userId) {
      throw new Error("You cannot remove yourself as owner");
    }
    const admin = await adminClient();
    const { error } = await admin
      .from("organization_members")
      .delete()
      .eq("organization_id", orgId)
      .eq("user_id", data.memberUserId)
      .neq("role", "owner");
    if (error) throw error;
    return { ok: true };
  });
