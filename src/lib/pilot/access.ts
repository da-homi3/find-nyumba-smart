import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ForbiddenError, requireRole } from "@/lib/api/_authz";
import { getUserOrganizationId } from "@/lib/api/nyumba/nyumba-shared";

type Admin = SupabaseClient<Database>;
type UserClient = SupabaseClient<Database>;

export async function requireAdminUser(
  userClient: UserClient,
  _admin: Admin,
  userId: string,
): Promise<void> {
  await requireRole(userClient, userId, "admin");
}

export async function assertPilotOrgAccess(
  admin: Admin,
  userId: string,
  pilotId: string,
  { requireAdmin = false }: { requireAdmin?: boolean } = {},
): Promise<{
  pilot: Database["public"]["Tables"]["pilot_partnerships"]["Row"];
  isAdmin: boolean;
}> {
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  if (requireAdmin && !isAdmin) throw new ForbiddenError("Admin access required");

  const { data: pilot, error } = await admin
    .from("pilot_partnerships")
    .select("*")
    .eq("id", pilotId)
    .maybeSingle();
  if (error) throw error;
  if (!pilot) throw new ForbiddenError("Pilot not found");
  if (isAdmin) return { pilot, isAdmin: true };

  if (!pilot.organization_id) throw new ForbiddenError("Pilot is not linked to an organization");
  const orgId = await getUserOrganizationId(admin, userId);
  if (!orgId || orgId !== pilot.organization_id) {
    throw new ForbiddenError("You cannot access this pilot partnership");
  }
  return { pilot, isAdmin: false };
}

export async function listUserPilotIds(admin: Admin, userId: string): Promise<string[]> {
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  if ((roles ?? []).some((r) => r.role === "admin")) {
    const { data } = await admin.from("pilot_partnerships").select("id");
    return (data ?? []).map((p) => p.id);
  }
  const orgId = await getUserOrganizationId(admin, userId);
  if (!orgId) return [];
  const { data } = await admin.from("pilot_partnerships").select("id").eq("organization_id", orgId);
  return (data ?? []).map((p) => p.id);
}
