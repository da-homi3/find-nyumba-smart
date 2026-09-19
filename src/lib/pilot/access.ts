import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ForbiddenError, requireRole } from "@/lib/api/_authz";
import { getUserOrganizationId } from "@/lib/api/nyumba/nyumba-shared";
import {
  PILOT_LISTING_LIMIT,
  daysRemaining,
  isPilotAccessWindowOpen,
} from "@/lib/pilot/types";

type Admin = SupabaseClient<Database>;
type UserClient = SupabaseClient<Database>;

export type ActivePilotAccess = {
  id: string;
  partnerName: string;
  partnerType: string;
  status: string;
  endsAt: string | null;
  daysRemaining: number | null;
  listingLimit: number;
};

async function userEmail(admin: Admin, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) return null;
    return data.user?.email?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

async function loadCandidatePilots(admin: Admin, userId: string) {
  const [orgId, email] = await Promise.all([
    getUserOrganizationId(admin, userId),
    userEmail(admin, userId),
  ]);
  const filters: string[] = [];
  if (orgId) filters.push(`organization_id.eq.${orgId}`);
  if (email) filters.push(`primary_contact_email.eq."${email.replaceAll('"', "")}"`);
  if (!filters.length) return [] as Database["public"]["Tables"]["pilot_partnerships"]["Row"][];

  const { data, error } = await admin
    .from("pilot_partnerships")
    .select("*")
    .or(filters.join(","))
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getActivePilotAccess(
  admin: Admin,
  userId: string,
  now = new Date(),
): Promise<ActivePilotAccess | null> {
  const pilots = await loadCandidatePilots(admin, userId);
  const open = pilots.find((pilot) => isPilotAccessWindowOpen(pilot, now));
  if (!open) return null;
  return {
    id: open.id,
    partnerName: open.partner_name,
    partnerType: open.partner_type,
    status: open.status,
    endsAt: open.pilot_end_date,
    daysRemaining: daysRemaining(open.pilot_end_date, now),
    listingLimit: PILOT_LISTING_LIMIT,
  };
}

export async function attachPropertyToActivePilot(
  admin: Admin,
  userId: string,
  propertyId: string,
): Promise<void> {
  const pilot = await getActivePilotAccess(admin, userId);
  if (!pilot) return;
  const now = new Date().toISOString();
  const { error } = await admin.from("pilot_properties").upsert(
    {
      pilot_id: pilot.id,
      property_id: propertyId,
      status: "LIVE",
      approved_at: now,
    },
    { onConflict: "pilot_id,property_id" },
  );
  if (error) throw error;
}

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
  const pilots = await loadCandidatePilots(admin, userId);
  return pilots.map((p) => p.id);
}
