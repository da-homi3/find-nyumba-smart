import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";

type AuthMeta = Record<string, unknown>;

function metaString(meta: AuthMeta, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

async function upsertTenantProfile(
  supabaseAdmin: (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"],
  userId: string,
  meta: AuthMeta,
) {
  const fullName = metaString(meta, "full_name", "name");
  const metaPhone = metaString(meta, "phone");
  const avatarUrl = metaString(meta, "avatar_url", "picture");

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("phone, full_name, avatar_url, active_portal")
    .eq("id", userId)
    .maybeSingle();

  const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName || existing?.full_name || null,
      // Never wipe a saved phone with null (Google OAuth has no phone metadata).
      phone: metaPhone || existing?.phone || null,
      avatar_url: avatarUrl || existing?.avatar_url || null,
      // Preserve portal preference for multi-role accounts.
      active_portal: existing?.active_portal || "tenant",
    },
    { onConflict: "id" },
  );
  if (profileErr) throw new Error(profileErr.message);
  return fullName;
}

async function ensureTenantRole(
  supabaseAdmin: (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"],
  userId: string,
): Promise<{ roles: string[]; hasPrivileged: boolean }> {
  const { data: existingRoles, error: rolesReadErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesReadErr) throw new Error(rolesReadErr.message);

  const roles = (existingRoles ?? []).map((r: { role: string }) => r.role as string);
  const hasPrivileged = roles.some((role: string) =>
    ["landlord", "manager", "agency", "admin", "caretaker"].includes(role),
  );

  if (!hasPrivileged && !roles.includes("tenant")) {
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "tenant",
    });
    if (roleErr && !/duplicate|unique/i.test(roleErr.message)) {
      throw new Error(roleErr.message);
    }
  }

  return { roles, hasPrivileged };
}

/**
 * After Google (or any) sign-in, ensure profile + tenant role exist.
 * Safe to call repeatedly — upserts / ignores conflicts.
 */
export const ensureTenantAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authErr) throw new Error(authErr.message);
    const user = authData.user;
    if (!user) throw new Error("User not found");

    const meta = (user.user_metadata ?? {}) as AuthMeta;
    const fullName = await upsertTenantProfile(supabaseAdmin, userId, meta);
    const { roles, hasPrivileged } = await ensureTenantRole(supabaseAdmin, userId);

    // Stamp tenant intent on metadata when missing (helps future triggers / support).
    const metaRole = typeof meta.role === "string" ? meta.role.toLowerCase() : "";
    if (!metaRole || metaRole === "tenant") {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...meta,
          role: "tenant",
          full_name: fullName ?? meta.full_name ?? meta.name,
        },
      });
    }

    return { userId, role: hasPrivileged ? roles[0] : "tenant" };
  });
