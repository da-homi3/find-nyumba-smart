import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ORG_REQUIRED_ROLES } from "@/lib/account-roles";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { getAuthContext } from "@/lib/api/server-context";
import { grantPortalListerAccess } from "@/lib/api/portal-approval";
import type { PortalListerRole } from "@/lib/payments/portal-trial";
import { getSiteUrl } from "@/lib/site";

async function sendApplicantApproved(
  payload: Parameters<Awaited<typeof import("@/lib/api/notify")>["notifyApplicantApproved"]>[0],
) {
  const { notifyApplicantApproved } = await import("@/lib/api/notify");
  await notifyApplicantApproved(payload);
}

async function sendApplicantRejected(
  payload: Parameters<Awaited<typeof import("@/lib/api/notify")>["notifyApplicantRejected"]>[0],
) {
  const { notifyApplicantRejected } = await import("@/lib/api/notify");
  await notifyApplicantRejected(payload);
}

async function notifyOpsPendingApplication(opts: {
  applicantName: string;
  applicantEmail: string;
  role: string;
  orgName?: string;
}) {
  const { notifyOpsNewApplication } = await import("@/lib/api/notify");
  await notifyOpsNewApplication({
    ...opts,
    reviewUrl: `${getSiteUrl()}/admin?tab=applications`,
  });
}

export type PortalApplication = {
  id: string;
  user_id: string;
  requested_role: PortalListerRole;
  organization_name: string | null;
  phone: string | null;
  notes: string | null;
  status: PortalApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

export type PortalApplicationStatus = "pending" | "approved" | "rejected";

export const listMyPortalApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    const { data, error } = await supabase
      .from("portal_applications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PortalApplication[];
  });

const privilegedRoleSchema = z.enum(["landlord", "manager", "agency"]);

/** Creates or refreshes a pending portal application — does not grant portal access. */
async function upsertPendingPortalApplication(input: {
  userId: string;
  requestedRole: PortalListerRole;
  organizationName?: string;
  phone?: string;
  notes?: string;
}): Promise<{ id: string; status: PortalApplicationStatus; alreadyApproved: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from("portal_applications")
    .select("id, status")
    .eq("user_id", input.userId)
    .eq("requested_role", input.requestedRole)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.status === "approved") {
    return { id: existing.id, status: "approved", alreadyApproved: true };
  }

  if (existing?.id) {
    const { data: row, error } = await supabaseAdmin
      .from("portal_applications")
      .update({
        organization_name: input.organizationName ?? null,
        phone: input.phone ?? null,
        notes: input.notes ?? null,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("id, status")
      .single();
    if (error) throw error;
    return { id: row.id, status: "pending", alreadyApproved: false };
  }

  const { data: row, error } = await supabaseAdmin
    .from("portal_applications")
    .insert({
      user_id: input.userId,
      requested_role: input.requestedRole,
      organization_name: input.organizationName ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      status: "pending",
    })
    .select("id, status")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await supabaseAdmin
        .from("portal_applications")
        .select("id, status")
        .eq("user_id", input.userId)
        .eq("requested_role", input.requestedRole)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (retry) {
        return {
          id: retry.id,
          status: retry.status as PortalApplicationStatus,
          alreadyApproved: retry.status === "approved",
        };
      }
    }
    throw error;
  }
  return { id: row.id, status: "pending", alreadyApproved: false };
}

function validatePortalApplicationInput(data: {
  requestedRole: PortalListerRole;
  organizationName?: string;
  phone?: string;
}) {
  if (!data.phone?.trim()) {
    throw new Error("A verified M-Pesa phone number is required for this application");
  }
  if (ORG_REQUIRED_ROLES.has(data.requestedRole) && !data.organizationName?.trim()) {
    throw new Error(
      data.requestedRole === "landlord"
        ? "Portfolio or business name is required for landlord applications"
        : "Organization name is required for this account type",
    );
  }
}

/** Persists portal application when signup returns a user id but no session yet. */
export const registerPortalApplicationAfterSignup = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      applicantName: z.string().trim().min(1),
      applicantEmail: z.string().email(),
      requestedRole: privilegedRoleSchema,
      organizationName: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(30).optional(),
      reviewUrl: z.string().url().optional(),
    }),
  )
  .handler(async ({ data }) => {
    checkRateLimit(`portal-signup:${data.applicantEmail}`, RATE_LIMITS.portalSignup);
    validatePortalApplicationInput(data);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (userData.user?.email?.toLowerCase() !== data.applicantEmail.toLowerCase()) {
      throw new Error("Invalid signup reference");
    }

    const app = await upsertPendingPortalApplication({
      userId: data.userId,
      requestedRole: data.requestedRole,
      organizationName: data.organizationName,
      phone: data.phone,
    });

    if (!app.alreadyApproved) {
      await notifyOpsPendingApplication({
        applicantName: data.applicantName,
        applicantEmail: data.applicantEmail,
        role: data.requestedRole,
        orgName: data.organizationName,
      });
    }

    return { ok: true as const, autoApproved: false as const, status: app.status };
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
    const { supabase, userId } = getAuthContext(context);
    validatePortalApplicationInput(data);

    const app = await upsertPendingPortalApplication({
      userId,
      requestedRole: data.requestedRole,
      organizationName: data.organizationName,
      phone: data.phone,
      notes: data.notes,
    });

    const { data: row, error: fetchErr } = await supabase
      .from("portal_applications")
      .select("*")
      .eq("id", app.id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!row) throw new Error("Could not submit your application. Please try again.");

    if (!app.alreadyApproved) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      const email = userData.user?.email ?? "";
      const name = userData.user?.user_metadata?.full_name ?? userData.user?.email ?? "Applicant";
      await notifyOpsPendingApplication({
        applicantName: name,
        applicantEmail: email,
        role: data.requestedRole,
        orgName: data.organizationName,
      });
    }

    return {
      ...(row as PortalApplication),
      trialStarted: false,
      trialEnd: null,
    };
  });

export const listPendingApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: apps, error } = await supabaseAdmin
      .from("portal_applications")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!apps?.length) return [];

    const userIds = [...new Set(apps.map((a) => a.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return apps.map((app) => ({
      ...app,
      profiles: profileMap.get(app.user_id) ?? null,
    }));
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
    const { supabase, userId } = getAuthContext(context);
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
      await sendApplicantRejected({
        email,
        name,
        role: app.requested_role,
        reason: data.rejectionReason,
      });
      return { status: "rejected" as const };
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

    const { organizationId, trialStarted, trialEnd } = await grantPortalListerAccess(
      supabaseAdmin,
      {
        userId: app.user_id,
        requestedRole: app.requested_role as PortalListerRole,
        organizationName: app.organization_name,
        startTrial: true,
      },
    );

    await sendApplicantApproved({ email, name, role: app.requested_role });

    return { status: "approved" as const, organizationId, trialStarted, trialEnd };
  });

export const getMyProfilePortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
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
    const { supabase, userId } = getAuthContext(context);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const owned = new Set((roles ?? []).map((r) => r.role));
    const required: Record<string, string> = {
      landlord: "landlord",
      manager: "manager",
      agency: "agency",
      admin: "admin",
    };
    const need = required[data.portal];
    if (need && !(owned as Set<string>).has(need)) {
      throw new Error(`You do not have access to the ${data.portal} portal`);
    }
    // Admin portal is role-gated only; profiles.active_portal check constraint omits admin.
    if (data.portal === "admin") {
      return { portal: data.portal };
    }
    const { error } = await supabase
      .from("profiles")
      .update({ active_portal: data.portal })
      .eq("id", userId);
    if (error) throw error;
    return { portal: data.portal };
  });

/** Used when an existing user applies to a privileged portal (auth duplicate signup path). */
export async function submitPendingPortalApplicationForUser(input: {
  userId: string;
  requestedRole: PortalListerRole;
  organizationName?: string;
  phone?: string;
  applicantName: string;
  applicantEmail: string;
}) {
  validatePortalApplicationInput({
    requestedRole: input.requestedRole,
    organizationName: input.organizationName,
    phone: input.phone,
  });
  const app = await upsertPendingPortalApplication({
    userId: input.userId,
    requestedRole: input.requestedRole,
    organizationName: input.organizationName,
    phone: input.phone,
  });
  if (!app.alreadyApproved) {
    await notifyOpsPendingApplication({
      applicantName: input.applicantName,
      applicantEmail: input.applicantEmail,
      role: input.requestedRole,
      orgName: input.organizationName,
    });
  }
  return app;
}
