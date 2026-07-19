import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";

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

    const meta = user.user_metadata ?? {};
    const fullName =
      (typeof meta.full_name === "string" && meta.full_name.trim()) ||
      (typeof meta.name === "string" && meta.name.trim()) ||
      null;
    const phone = typeof meta.phone === "string" ? meta.phone.trim() : null;
    const avatarUrl =
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      null;

    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName,
        phone: phone || null,
        avatar_url: avatarUrl,
        active_portal: "tenant",
      },
      { onConflict: "id" },
    );
    if (profileErr) throw new Error(profileErr.message);

    const { data: existingRoles, error: rolesReadErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesReadErr) throw new Error(rolesReadErr.message);

    const roles = (existingRoles ?? []).map((r) => r.role as string);
    const hasPrivileged = roles.some((r) =>
      ["landlord", "manager", "agency", "admin", "caretaker"].includes(r),
    );

    // Only assign tenant when the user has no portal/admin roles yet.
    if (!hasPrivileged && !roles.includes("tenant")) {
      const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role: "tenant",
      });
      if (roleErr && !/duplicate|unique/i.test(roleErr.message)) {
        throw new Error(roleErr.message);
      }
    }

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
