import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { getAuthContext, profileFromMap } from "@/lib/api/server-context";

async function loadProfilesByIds(userIds: string[]) {
  if (userIds.length === 0)
    return new Map<
      string,
      { full_name: string | null; phone: string | null; avatar_url: string | null }
    >();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, avatar_url")
    .in("id", userIds);
  return new Map((data ?? []).map((p) => [p.id, p]));
}

export const listAdminVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");

    const { data: rows, error } = await supabase
      .from("verifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    const profileMap = await loadProfilesByIds([...new Set((rows ?? []).map((r) => r.user_id))]);
    return (rows ?? []).map((row) => ({
      ...row,
      profiles: profileMap.get(row.user_id) ?? null,
    }));
  });

export const updateVerificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("verifications")
      .update({ status: data.status, notes: data.notes ?? null })
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw error;

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: userId,
      action: `VERIFICATION_${data.status.toUpperCase()}`,
      target_id: data.id,
      details: `Updated verification status to ${data.status}. Notes: ${data.notes ?? ""}`,
    });

    return row;
  });

export const listAdminScamReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabase
      .from("scam_reports")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) throw error;

    const propertyIds = [
      ...new Set((rows ?? []).map((r) => r.property_id).filter(Boolean)),
    ] as string[];
    const reporterIds = [
      ...new Set((rows ?? []).map((r) => r.reporter_id).filter(Boolean)),
    ] as string[];

    const [{ data: properties }, reporterMap] = await Promise.all([
      propertyIds.length
        ? supabaseAdmin
            .from("properties")
            .select("id, title, neighborhood, owner_id")
            .in("id", propertyIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              title: string;
              neighborhood: string;
              owner_id: string | null;
            }[],
          }),
      loadProfilesByIds(reporterIds),
    ]);

    const propertyMap = new Map((properties ?? []).map((p) => [p.id, p]));

    return (rows ?? []).map((row) => ({
      ...row,
      properties: propertyMap.get(row.property_id) ?? null,
      reporter: profileFromMap(row.reporter_id, reporterMap),
    }));
  });

export const updateScamReportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["reviewed", "dismissed"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("scam_reports")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw error;

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: userId,
      action: `SCAM_REPORT_${data.status.toUpperCase()}`,
      target_id: data.id,
      details: `Updated scam report status to ${data.status}.`,
    });

    return row;
  });

export const listAdminAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");

    const { data: rows, error } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    const adminIds = [...new Set((rows ?? []).map((r) => r.admin_id).filter(Boolean))] as string[];
    const profileMap = await loadProfilesByIds(adminIds);
    return (rows ?? []).map((row) => ({
      ...row,
      admin: profileFromMap(row.admin_id, profileMap),
    }));
  });
