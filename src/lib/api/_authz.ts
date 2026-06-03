import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "Forbidden: required role missing") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Server-side role enforcement. Throws ForbiddenError if `userId` does not
 * have ANY of the required `roles`. Uses the user-scoped supabase client
 * (RLS-aware) so users can only see their own roles.
 */
export async function requireRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  roles: AppRole | AppRole[],
): Promise<void> {
  const required = Array.isArray(roles) ? roles : [roles];
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);

  if (error) throw error;
  const owned = new Set((data ?? []).map((r) => r.role as AppRole));
  if (!required.some((r) => owned.has(r))) {
    throw new ForbiddenError(`Forbidden: requires role ${required.join(" or ")}`);
  }
}
