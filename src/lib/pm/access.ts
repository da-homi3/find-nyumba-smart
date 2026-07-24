import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ForbiddenError } from "@/lib/api/_authz";
import { getUserOrganizationId } from "@/lib/api/nyumba/nyumba-shared";
import { staffCan, type PmStaffRole } from "@/lib/pm/permissions";

export type { PmStaffRole };
export { staffCan };

export type PmPropertyRow = {
  id: string;
  owner_user_id: string;
  agency_id: string | null;
  name: string;
  property_type: string;
  address: string;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Loose client — pm_* tables are not yet in generated Database types. */
export type PmDb = SupabaseClient<any>;

export function asPmDb(client: SupabaseClient<Database> | SupabaseClient<any>): PmDb {
  return client as PmDb;
}

export function assertStaffCan(staffRole: string, permission: string): void {
  if (!staffCan(staffRole, permission)) {
    throw new ForbiddenError(`Staff role '${staffRole}' cannot perform '${permission}'`);
  }
}

async function userIsAdmin(admin: PmDb, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

/**
 * Ensures the authenticated user may access a managed (pm_*) property.
 * Admins and owners get staffRole `owner`; staff rows and org members get their role.
 */
export async function assertPmPropertyAccess(
  admin: PmDb,
  userId: string,
  propertyId: string,
): Promise<{ property: PmPropertyRow; staffRole: PmStaffRole }> {
  const { data: property, error } = await admin
    .from("pm_properties")
    .select("*")
    .eq("id", propertyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!property) {
    const notFound = new Error("Property not found");
    (notFound as Error & { status?: number }).status = 404;
    throw notFound;
  }

  const row = property as PmPropertyRow;

  if (await userIsAdmin(admin, userId)) {
    return { property: row, staffRole: "owner" };
  }

  if (row.owner_user_id === userId) {
    return { property: row, staffRole: "owner" };
  }

  const { data: staff } = await admin
    .from("pm_property_staff")
    .select("role")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (staff?.role) {
    return { property: row, staffRole: staff.role as PmStaffRole };
  }

  if (row.agency_id) {
    const orgId = await getUserOrganizationId(admin as SupabaseClient<Database>, userId);
    if (orgId && orgId === row.agency_id) {
      return { property: row, staffRole: "property_manager" };
    }
  }

  throw new ForbiddenError("No access to this property");
}
