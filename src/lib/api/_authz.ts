import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

type RequiredRoles = AppRole | AppRole[];

const PRIVILEGED_ROLES = new Set<AppRole>(["landlord", "manager", "agency", "caretaker", "admin"]);

const ALL_ROLES = new Set<AppRole>(["tenant", ...PRIVILEGED_ROLES]);

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "Forbidden: required role missing") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function isAppRole(role: string): role is AppRole {
  return ALL_ROLES.has(role as AppRole);
}

async function loadUserRoles(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Set<AppRole>> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.role).filter(isAppRole));
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
  roles: RequiredRoles,
): Promise<void> {
  const required = Array.isArray(roles) ? roles : [roles];
  const owned = await loadUserRoles(supabase, userId);

  // Admins have unrestricted access across tenant and portal surfaces.
  if (owned.has("admin")) return;

  if (required.length === 1 && required[0] === "tenant") {
    if (owned.has("tenant")) return;
    const hasPrivileged = [...owned].some((r) => PRIVILEGED_ROLES.has(r));
    if (!hasPrivileged) return;
    throw new ForbiddenError("Forbidden: requires role tenant");
  }

  if (!required.some((r) => owned.has(r))) {
    throw new ForbiddenError(`Forbidden: requires role ${required.join(" or ")}`);
  }
}

/** True when the user has the admin role (uses the given client / RLS scope). */
export async function userHasAdminRole(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const owned = await loadUserRoles(supabase, userId);
  return owned.has("admin");
}
