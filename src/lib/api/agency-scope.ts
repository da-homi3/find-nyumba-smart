import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ForbiddenError } from "@/lib/api/_authz";
import { getUserOrganizationId } from "@/lib/api/nyumba/nyumba-shared";

type Db = SupabaseClient<Database>;

export type PropertyScopeRow = {
  id: string;
  owner_id: string | null;
  organization_id: string | null;
};

/**
 * Ensures the authenticated user may read/write a property.
 * Admins bypass; landlords own; agency/manager must share organization_id.
 */
export async function assertPropertyAccess(
  supabase: Db,
  userId: string,
  property: PropertyScopeRow,
  roles: Set<string>,
): Promise<void> {
  if (roles.has("admin")) return;
  if (property.owner_id === userId) return;

  if ((roles.has("manager") || roles.has("agency")) && property.organization_id) {
    const orgId = await getUserOrganizationId(supabase, userId);
    if (orgId && orgId === property.organization_id) return;
  }

  throw new ForbiddenError("You cannot access this property");
}

export async function loadPropertyScope(
  admin: Db,
  propertyId: string,
): Promise<PropertyScopeRow | null> {
  const { data, error } = await admin
    .from("properties")
    .select("id, owner_id, organization_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
