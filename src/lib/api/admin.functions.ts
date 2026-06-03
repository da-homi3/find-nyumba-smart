import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getContext(context: unknown) {
  const c = context as { supabase: SupabaseClient<Database>; userId: string };
  if (!c?.supabase || !c?.userId) throw new Error("Unauthorized");
  return c;
}

export const listAdminVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getContext(context);
    await requireRole(supabase, userId, "admin");

    const { data: rows, error } = await supabase
      .from("verifications")
      .select(`
        *,
        profiles:user_id (
          full_name,
          phone,
          avatar_url
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return rows;
  });

export const updateVerificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid(),
    status: z.enum(["approved", "rejected"]),
    notes: z.string().optional(),
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getContext(context);
    await requireRole(supabase, userId, "admin");

    const { data: row, error } = await supabase
      .from("verifications")
      .update({ status: data.status, notes: data.notes ?? null })
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw error;

    // Log admin audit
    await supabase.from("admin_audit_logs").insert({
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
    const { supabase, userId } = getContext(context);
    await requireRole(supabase, userId, "admin");

    const { data: rows, error } = await supabase
      .from("scam_reports")
      .select(`
        *,
        properties (
          title,
          neighborhood,
          owner_id
        ),
        reporter:reporter_id (
          full_name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return rows;
  });

export const updateScamReportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid(),
    status: z.enum(["reviewed", "dismissed"]),
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getContext(context);
    await requireRole(supabase, userId, "admin");

    const { data: row, error } = await supabase
      .from("scam_reports")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("admin_audit_logs").insert({
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
    const { supabase, userId } = getContext(context);
    await requireRole(supabase, userId, "admin");

    const { data: rows, error } = await supabase
      .from("admin_audit_logs")
      .select(`
        *,
        admin:admin_id (
          full_name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return rows;
  });
