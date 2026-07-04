import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole, ForbiddenError } from "@/lib/api/_authz";
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

async function assertOrgOwner(
  supabase: ReturnType<typeof authContext>["supabase"],
  userId: string,
) {
  const orgId = await getUserOrganizationId(supabase, userId);
  if (!orgId) throw new ForbiddenError("No organization found for this account");

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
    let invitee = await findAuthUserByEmail(email);
    const admin = await adminClient();

    if (!invitee) {
      const password = `${crypto.randomUUID()}Aa1!`;
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: data.fullName?.trim() || email.split("@")[0],
          source: "org_team_invite",
        },
      });
      if (error || !created.user) {
        throw new Error(error?.message ?? "Could not create invitee account");
      }
      invitee = created.user;
      await admin.from("profiles").upsert({
        id: invitee.id,
        full_name: data.fullName?.trim() || email.split("@")[0],
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

    // Grant portal role so they can sign in to the right portal after approval
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

    return { ok: true, userId: invitee.id, status: "pending" as const };
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
