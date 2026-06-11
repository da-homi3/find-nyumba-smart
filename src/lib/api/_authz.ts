import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

const PRIVILEGED_ROLES: AppRole[] = ["landlord", "manager", "agency", "caretaker", "admin"];

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "Forbidden: required role missing") {
    super(message);
    this.name = "ForbiddenError";
  }
}

async function loadUserRoles(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Set<AppRole>> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.role as AppRole));
}

/**
 * Server-side role enforcement. Throws ForbiddenError if `userId` does not
 * have ANY of the required `roles`. Uses the user-scoped supabase client
 * (RLS-aware) so users can only see their own roles.
 *
 * Tenant access: users with the tenant role OR no privileged roles (browse signups).
 */
export async function requireRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  roles: AppRole | AppRole[],
): Promise<void> {
  const required = Array.isArray(roles) ? roles : [roles];
  const owned = await loadUserRoles(supabase, userId);

  if (required.length === 1 && required[0] === "tenant") {
    if (owned.has("tenant")) return;
    const hasPrivileged = [...owned].some((r) => PRIVILEGED_ROLES.includes(r));
    if (!hasPrivileged) return;
    throw new ForbiddenError("Forbidden: requires role tenant");
  }

  if (!required.some((r) => owned.has(r))) {
    throw new ForbiddenError(`Forbidden: requires role ${required.join(" or ")}`);
  }
}
