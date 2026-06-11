import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PortalId } from "@/lib/portal-guard";
import {
  notifyApplicantApproved,
  notifyApplicantRejected,
  notifyOpsNewApplication,
} from "@/lib/api/notify";

export type PortalApplication = {
  id: string;
  user_id: string;
  requested_role: "landlord" | "manager" | "agency";
  organization_name: string | null;
  phone: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

function authContext(context: unknown) {
  const c = context as { supabase: SupabaseClient<Database>; userId: string };
  if (!c?.supabase || !c?.userId) throw new Error("Unauthorized");
  return c;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export const listMyPortalApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    const { data, error } = await supabase
      .from("portal_applications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PortalApplication[];
  });

/** Server-only ops email for privileged signups (avoids bundling SendGrid on the client). */
export const notifyOpsPortalApplicationEmail = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      applicantName: z.string().trim().min(1),
      applicantEmail: z.string().email(),
      role: z.string().trim().min(1),
      orgName: z.string().trim().optional(),
      reviewUrl: z.string().url(),
    }),
  )
  .handler(async ({ data }) => {
    await notifyOpsNewApplication(data);
    return { ok: true as const };
  });

export const submitPortalApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      requestedRole: z.enum(["landlord", "manager", "agency"]),
      organizationName: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(30).optional(),
      notes: z.string().trim().max(1000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    const { data: row, error } = await supabase
      .from("portal_applications")
      .insert({
        user_id: userId,
        requested_role: data.requestedRole,
        organization_name: data.organizationName ?? null,
        phone: data.phone ?? null,
        notes: data.notes ?? null,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw error;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userData.user?.email ?? "";
    const name = userData.user?.user_metadata?.full_name ?? userData.user?.email ?? "Applicant";

    await notifyOpsNewApplication({
      applicantName: name,
      applicantEmail: email,
      role: data.requestedRole,
      orgName: data.organizationName,
      reviewUrl: `${process.env.SITE_URL ?? "https://nyumba-search.kevinbuluma1.workers.dev"}/admin?tab=applications`,
    });

    return row as PortalApplication;
  });

export const listPendingApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("portal_applications")
      .select("*, profiles:user_id(full_name, phone)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const reviewPortalApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      applicationId: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      rejectionReason: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error: fetchErr } = await supabaseAdmin
      .from("portal_applications")
      .select("*")
      .eq("id", data.applicationId)
      .single();
    if (fetchErr || !app) throw new Error("Application not found");

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(app.user_id);
    const email = userData.user?.email ?? "";
    const name = userData.user?.user_metadata?.full_name ?? email;

    if (data.action === "reject") {
      await supabaseAdmin
        .from("portal_applications")
        .update({
          status: "rejected",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: data.rejectionReason ?? "Not approved at this time",
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.applicationId);
      await notifyApplicantRejected({
        email,
        name,
        role: app.requested_role,
        reason: data.rejectionReason,
      });
      return { status: "rejected" as const };
    }

    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: app.user_id, role: app.requested_role })
      .select()
      .maybeSingle();

    let organizationId: string | null = null;
    if (app.requested_role === "agency" && app.organization_name) {
      const slug = `${slugify(app.organization_name)}-${app.user_id.slice(0, 8)}`;
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .insert({
          name: app.organization_name,
          slug,
          type: "agency",
        })
        .select("id")
        .single();
      organizationId = org?.id ?? null;
      if (organizationId) {
        await supabaseAdmin.from("organization_members").insert({
          organization_id: organizationId,
          user_id: app.user_id,
          role: "owner",
        });
      }
    }

    await supabaseAdmin
      .from("portal_applications")
      .update({
        status: "approved",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.applicationId);

    const portalMap: Record<string, PortalId> = {
      landlord: "landlord",
      manager: "manager",
      agency: "agency",
    };
    await supabaseAdmin
      .from("profiles")
      .update({ active_portal: portalMap[app.requested_role] ?? "tenant" })
      .eq("id", app.user_id);

    await notifyApplicantApproved({ email, name, role: app.requested_role });

    return { status: "approved" as const, organizationId };
  });

export const getMyProfilePortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    const { data, error } = await supabase
      .from("profiles")
      .select("active_portal, is_portal_active, full_name, phone")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data;
  });

export const setActivePortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      portal: z.enum(["tenant", "landlord", "manager", "agency", "caretaker", "admin"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const owned = new Set((roles ?? []).map((r) => r.role));
    const required: Record<string, string> = {
      landlord: "landlord",
      manager: "manager",
      agency: "agency",
      admin: "admin",
    };
    const need = required[data.portal];
    if (need && !owned.has(need)) {
      throw new Error(`You do not have access to the ${data.portal} portal`);
    }
    const { error } = await supabase
      .from("profiles")
      .update({ active_portal: data.portal })
      .eq("id", userId);
    if (error) throw error;
    return { portal: data.portal };
  });
