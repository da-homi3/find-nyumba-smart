import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { requireRole } from "@/lib/api/_authz";
import { getAuthContext } from "@/lib/api/server-context";
import { assertPilotOrgAccess, listUserPilotIds } from "@/lib/pilot/access";
import { recordPilotEvent } from "@/lib/pilot/attribution";
export { resolvePilotAttribution, recordPilotEvent } from "@/lib/pilot/attribution";
import {
  canTransitionPilotStatus,
  COMMERCIAL_MODELS,
  CRM_PIPELINE_STATUSES,
  daysRemaining,
  kpiProgress,
  partnerTypeToAppRoles,
  partnerTypeToOrgType,
  PILOT_DURATION_DAYS,
  PILOT_EVENT_TYPES,
  PILOT_LEAD_STATUSES,
  PILOT_PARTNER_TYPES,
  slugifyPartnerName,
  type PilotStatus,
} from "@/lib/pilot/types";
import { getSiteUrl } from "@/lib/site";
import { rateLimitDistributed, rateLimitKeyFromHeaders } from "@/lib/api/rate-limit";
import { notifyAdminsPilotAlert, notifyPilotEvent, notifyPilotOrgMembers } from "@/lib/pilot/notify";
import { sendEmailResult } from "@/lib/email/send";
import { pilotPartnershipInviteEmail } from "@/lib/email/templates";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function randomTokenHex(byteLength = 32): string {
  // Prefer UUID entropy to avoid node:crypto randomBytes typing issues in Workers TS.
  return `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`.slice(
    0,
    byteLength * 2,
  );
}

function touchUpdated() {
  return new Date().toISOString();
}

async function ensureOrgMembership(
  admin: Awaited<ReturnType<typeof adminDb>>,
  organizationId: string,
  userId: string,
  role = "owner",
) {
  const { data: existing } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return;
  await admin.from("organization_members").insert({
    organization_id: organizationId,
    user_id: userId,
    role,
  });
}

async function createAndSendPilotInvite(
  admin: Awaited<ReturnType<typeof adminDb>>,
  input: {
    pilotId: string;
    partnerName: string;
    email: string;
    contactName?: string | null;
    durationDays?: number | null;
    createdBy: string;
    selfServe?: boolean;
  },
): Promise<{ inviteUrl: string; emailSent: boolean }> {
  const rawToken = randomTokenHex(32);
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await admin
    .from("pilot_invitations")
    .update({ status: "EXPIRED" })
    .eq("pilot_id", input.pilotId)
    .eq("status", "PENDING");
  await admin.from("pilot_invitations").insert({
    pilot_id: input.pilotId,
    email: input.email.toLowerCase(),
    token_hash: hashToken(rawToken),
    expires_at: expires.toISOString(),
    created_by: input.createdBy,
  });
  const inviteUrl = `${getSiteUrl()}/partner/invite/${rawToken}`;
  const tpl = pilotPartnershipInviteEmail({
    partnerName: input.partnerName,
    contactName: input.contactName,
    inviteUrl,
    durationDays: input.durationDays,
    selfServe: input.selfServe,
  });
  const sent = await sendEmailResult({
    to: input.email,
    templateId: "pilot-partnership-invite",
    ...tpl,
    metadata: { pilotId: input.pilotId, selfServe: Boolean(input.selfServe) },
  });
  if (!sent.ok) {
    console.warn(`[pilot] invite email failed for ${input.email}: ${sent.reason}`);
  }
  return { inviteUrl, emailSent: sent.ok };
}

async function transitionPilot(
  admin: Awaited<ReturnType<typeof adminDb>>,
  pilotId: string,
  to: PilotStatus,
  extra: Record<string, unknown> = {},
) {
  const { data: current, error } = await admin
    .from("pilot_partnerships")
    .select("status")
    .eq("id", pilotId)
    .single();
  if (error) throw error;
  if (!canTransitionPilotStatus(current.status as PilotStatus, to)) {
    throw new Error(`Cannot move pilot from ${current.status} to ${to}`);
  }
  const { data, error: updateError } = await admin
    .from("pilot_partnerships")
    .update({ status: to, updated_at: touchUpdated(), ...extra })
    .eq("id", pilotId)
    .select("*")
    .single();
  if (updateError) throw updateError;
  return data;
}

const createPilotSchema = z.object({
  partnerName: z.string().trim().min(2).max(160),
  partnerType: z.enum(PILOT_PARTNER_TYPES),
  primaryContactName: z.string().trim().min(2).max(120).optional(),
  primaryContactEmail: z.string().email(),
  primaryContactPhone: z.string().trim().min(9).max(30).optional(),
  pilotDurationDays: z.number().int().min(7).max(365).default(PILOT_DURATION_DAYS),
  proposedPropertyCount: z.number().int().min(0).max(500).optional(),
  objectives: z.array(z.string().trim().min(2).max(200)).max(20).default([]),
  successCriteria: z
    .array(
      z.object({
        metric: z.string().trim().min(2).max(80),
        target: z.number().min(0),
        unit: z.string().trim().max(40).default("count"),
      }),
    )
    .max(20)
    .default([]),
  notes: z.string().trim().max(4000).optional(),
  inviteNow: z.boolean().default(true),
});

export const createPilotPartnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createPilotSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = await adminDb();

    const start = new Date();
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + data.pilotDurationDays);
    const slugBase = slugifyPartnerName(data.partnerName) || "partner";
    const publicSlug = `${slugBase}-${randomTokenHex(3)}`;

    const { data: pilot, error } = await admin
      .from("pilot_partnerships")
      .insert({
        partner_name: data.partnerName,
        partner_type: data.partnerType,
        primary_contact_name: data.primaryContactName ?? null,
        primary_contact_email: data.primaryContactEmail,
        primary_contact_phone: data.primaryContactPhone ?? null,
        status: data.inviteNow ? "INVITED" : "DRAFT",
        pilot_start_date: start.toISOString().slice(0, 10),
        pilot_end_date: end.toISOString().slice(0, 10),
        pilot_duration_days: data.pilotDurationDays,
        proposed_property_count: data.proposedPropertyCount ?? null,
        created_by: userId,
        notes: data.notes ?? null,
        objectives: data.objectives as unknown as Json,
        success_criteria: data.successCriteria as unknown as Json,
        public_slug: publicSlug,
      })
      .select("*")
      .single();
    if (error) throw error;

    if (data.successCriteria.length) {
      await admin.from("pilot_kpis").insert(
        data.successCriteria.map((kpi, index) => ({
          pilot_id: pilot.id,
          metric: kpi.metric,
          target: kpi.target,
          unit: kpi.unit,
          sort_order: index,
        })),
      );
    }

    let inviteUrl: string | null = null;
    let emailSent = false;
    if (data.inviteNow) {
      const invite = await createAndSendPilotInvite(admin, {
        pilotId: pilot.id,
        partnerName: data.partnerName,
        email: data.primaryContactEmail,
        contactName: data.primaryContactName,
        durationDays: data.pilotDurationDays,
        createdBy: userId,
      });
      inviteUrl = invite.inviteUrl;
      emailSent = invite.emailSent;
    }

    return { pilot, inviteUrl, emailSent };
  });

/** Admin: email-only invite — partner fills company details in onboarding. */
export const invitePartnerSelfServe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email(),
      pilotDurationDays: z.number().int().min(7).max(365).default(PILOT_DURATION_DAYS),
      notes: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = await adminDb();

    const email = data.email.trim().toLowerCase();
    const start = new Date();
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + data.pilotDurationDays);
    const publicSlug = `partner-${randomTokenHex(4)}`;

    const { data: pilot, error } = await admin
      .from("pilot_partnerships")
      .insert({
        partner_name: "Pending partner details",
        partner_type: "OTHER",
        primary_contact_email: email,
        status: "INVITED",
        pilot_start_date: start.toISOString().slice(0, 10),
        pilot_end_date: end.toISOString().slice(0, 10),
        pilot_duration_days: data.pilotDurationDays,
        created_by: userId,
        notes: data.notes ?? "Self-serve invite — partner completes details in onboarding.",
        objectives: [] as unknown as Json,
        success_criteria: [] as unknown as Json,
        public_slug: publicSlug,
        onboarding: { selfServe: true } as unknown as Json,
      })
      .select("*")
      .single();
    if (error) throw error;

    const invite = await createAndSendPilotInvite(admin, {
      pilotId: pilot.id,
      partnerName: "Pending partner details",
      email,
      durationDays: data.pilotDurationDays,
      createdBy: userId,
      selfServe: true,
    });

    return {
      pilot,
      inviteUrl: invite.inviteUrl,
      emailSent: invite.emailSent,
    };
  });

export const resendPilotInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      pilotId: z.string().uuid(),
      email: z.string().email().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = await adminDb();
    const { data: pilot, error } = await admin
      .from("pilot_partnerships")
      .select("*")
      .eq("id", data.pilotId)
      .single();
    if (error) throw error;
    const email = (data.email ?? pilot.primary_contact_email ?? "").trim().toLowerCase();
    if (!email) throw new Error("Pilot has no contact email for invite");
    const invite = await createAndSendPilotInvite(admin, {
      pilotId: pilot.id,
      partnerName: pilot.partner_name,
      email,
      contactName: pilot.primary_contact_name,
      durationDays: pilot.pilot_duration_days,
      createdBy: userId,
    });
    if (["DRAFT", "DECLINED", "CANCELLED"].includes(pilot.status)) {
      await admin
        .from("pilot_partnerships")
        .update({
          status: "INVITED",
          primary_contact_email: email,
          updated_at: touchUpdated(),
        })
        .eq("id", pilot.id);
    }
    return invite;
  });

export const updatePilotPublicSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      pilotId: z.string().uuid(),
      showPartnerBadge: z.boolean().optional(),
      publicSlug: z
        .string()
        .trim()
        .min(2)
        .max(60)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional()
        .nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = await adminDb();
    const patch: Database["public"]["Tables"]["pilot_partnerships"]["Update"] = {
      updated_at: touchUpdated(),
    };
    if (data.showPartnerBadge !== undefined) patch.show_partner_badge = data.showPartnerBadge;
    if (data.publicSlug !== undefined) {
      patch.public_slug = data.publicSlug ? data.publicSlug : null;
    }
    const { data: row, error } = await admin
      .from("pilot_partnerships")
      .update(patch)
      .eq("id", data.pilotId)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const listPilotPartnerships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = await adminDb();
    const { data, error } = await admin
      .from("pilot_partnerships")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((pilot) => ({
      ...pilot,
      daysRemaining: daysRemaining(pilot.pilot_end_date),
    }));
  });

async function loadPilotDetail(admin: Awaited<ReturnType<typeof adminDb>>, pilotId: string) {
  const { data: pilot, error } = await admin
    .from("pilot_partnerships")
    .select("*")
    .eq("id", pilotId)
    .single();
  if (error) throw error;

  const [
    { data: properties },
    { data: kpis },
    { data: leads },
    { data: notes },
    { data: metrics },
  ] = await Promise.all([
    admin
      .from("pilot_properties")
      .select("*, properties(id, title, neighborhood, rent_kes, images, property_type, is_active)")
      .eq("pilot_id", pilotId)
      .order("added_at", { ascending: false }),
    admin.from("pilot_kpis").select("*").eq("pilot_id", pilotId).order("sort_order"),
    admin
      .from("pilot_leads")
      .select("*")
      .eq("pilot_id", pilotId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("pilot_activity_notes")
      .select("*")
      .eq("pilot_id", pilotId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("pilot_metrics_daily")
      .select("*")
      .eq("pilot_id", pilotId)
      .order("day", { ascending: false })
      .limit(90),
  ]);

  const totals = (metrics ?? []).reduce(
    (acc, row) => {
      acc.views += row.views;
      acc.saves += row.saves;
      acc.enquiries += row.enquiries;
      acc.calls += row.call_clicks;
      acc.whatsapp += row.whatsapp_clicks;
      acc.viewings += row.viewing_requests;
      acc.impressions += row.impressions;
      return acc;
    },
    { views: 0, saves: 0, enquiries: 0, calls: 0, whatsapp: 0, viewings: 0, impressions: 0 },
  );

  return {
    pilot: { ...pilot, daysRemaining: daysRemaining(pilot.pilot_end_date) },
    properties: properties ?? [],
    kpis: (kpis ?? []).map((kpi) => ({
      ...kpi,
      progress: kpiProgress(Number(kpi.actual), Number(kpi.target)),
    })),
    leads: leads ?? [],
    notes: notes ?? [],
    metrics: metrics ?? [],
    totals,
    funnel: [
      { stage: "PROPERTY_IMPRESSIONS", value: totals.impressions },
      { stage: "PROPERTY_VIEWS", value: totals.views },
      { stage: "PROPERTY_SAVES", value: totals.saves },
      { stage: "ENQUIRIES", value: totals.enquiries },
      { stage: "CALL_WHATSAPP", value: totals.calls + totals.whatsapp },
      { stage: "VIEWING_REQUEST", value: totals.viewings },
      {
        stage: "QUALIFIED_LEAD",
        value: (leads ?? []).filter((l) =>
          ["QUALIFIED", "VIEWING_SCHEDULED", "VIEWED", "CONVERTED"].includes(l.status),
        ).length,
      },
    ],
  };
}

export const getPilotPartnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ pilotId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const admin = await adminDb();
    await assertPilotOrgAccess(admin, userId, data.pilotId);
    return loadPilotDetail(admin, data.pilotId);
  });

const lifecycleSchema = z.object({
  pilotId: z.string().uuid(),
  action: z.enum([
    "approve",
    "reject",
    "start_onboarding",
    "activate",
    "pause",
    "extend",
    "complete",
    "convert",
    "cancel",
  ]),
  extendDays: z.number().int().min(1).max(180).optional(),
  commercialModel: z.enum(COMMERCIAL_MODELS).optional(),
  reason: z.string().trim().max(2000).optional(),
});

export const updatePilotLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(lifecycleSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = await adminDb();

    let result;
    switch (data.action) {
      case "approve":
        result = await transitionPilot(admin, data.pilotId, "APPROVED", {
          approved_by: userId,
          approved_at: touchUpdated(),
        });
        break;
      case "reject":
        result = await transitionPilot(admin, data.pilotId, "DECLINED", {
          notes: data.reason ?? null,
        });
        break;
      case "start_onboarding":
        result = await transitionPilot(admin, data.pilotId, "ONBOARDING");
        break;
      case "activate":
        result = await transitionPilot(admin, data.pilotId, "ACTIVE");
        break;
      case "pause":
        result = await transitionPilot(admin, data.pilotId, "PAUSED");
        break;
      case "extend": {
        const { data: pilot } = await admin
          .from("pilot_partnerships")
          .select("pilot_end_date, status")
          .eq("id", data.pilotId)
          .single();
        const base = pilot?.pilot_end_date ? new Date(pilot.pilot_end_date) : new Date();
        base.setUTCDate(base.getUTCDate() + (data.extendDays ?? 30));
        result = await transitionPilot(admin, data.pilotId, "EXTENDED", {
          pilot_end_date: base.toISOString().slice(0, 10),
        });
        break;
      }
      case "complete":
        result = await transitionPilot(admin, data.pilotId, "COMPLETED", {
          completed_at: touchUpdated(),
        });
        break;
      case "convert":
        result = await transitionPilot(admin, data.pilotId, "CONVERTED", {
          converted_at: touchUpdated(),
          commercial_model: data.commercialModel ?? "PORTFOLIO_PARTNERSHIP",
          partnership_start_date: new Date().toISOString().slice(0, 10),
        });
        break;
      case "cancel":
        result = await transitionPilot(admin, data.pilotId, "CANCELLED", {
          notes: data.reason ?? null,
        });
        break;
      default:
        throw new Error("Unknown action");
    }

    void notifyPilotOrgMembers(admin, result.organization_id, {
      title: `Pilot ${data.action.replaceAll("_", " ")}`,
      body: `Your partnership status is now ${result.status}.`,
      href: "/partner",
    }).catch(() => undefined);

    return result;
  });

export const acceptPilotInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ token: z.string().min(20).max(200) }))
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const admin = await adminDb();
    const tokenHash = hashToken(data.token);
    const { data: invite, error } = await admin
      .from("pilot_invitations")
      .select("*, pilot_partnerships(*)")
      .eq("token_hash", tokenHash)
      .eq("status", "PENDING")
      .maybeSingle();
    if (error) throw error;
    if (!invite) throw new Error("Invitation not found or already used");
    return finalizePilotInviteAccept(admin, invite, userId);
  });

/** Accept a pending invite via public partner slug (vanity URL). */
export const acceptPilotInvitationBySlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ slug: z.string().trim().min(2).max(80) }))
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const admin = await adminDb();
    const slug = data.slug.trim().toLowerCase();
    const { data: pilot, error: pilotError } = await admin
      .from("pilot_partnerships")
      .select("id")
      .eq("public_slug", slug)
      .maybeSingle();
    if (pilotError) throw pilotError;
    if (!pilot) throw new Error("Invitation not found");

    const { data: invite, error } = await admin
      .from("pilot_invitations")
      .select("*, pilot_partnerships(*)")
      .eq("pilot_id", pilot.id)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!invite) throw new Error("Invitation not found or already used");
    return finalizePilotInviteAccept(admin, invite, userId);
  });

type InviteWithPilot = {
  id: string;
  email: string;
  expires_at: string;
  pilot_partnerships: unknown;
};

async function finalizePilotInviteAccept(
  admin: Awaited<ReturnType<typeof adminDb>>,
  invite: InviteWithPilot,
  userId: string,
) {
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await admin.from("pilot_invitations").update({ status: "EXPIRED" }).eq("id", invite.id);
    throw new Error("Invitation has expired");
  }

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr) throw authErr;
  const signedInEmail = authUser.user?.email?.trim().toLowerCase() ?? "";
  if (!signedInEmail || signedInEmail !== invite.email.toLowerCase()) {
    throw new Error(
      `Sign in with ${invite.email} to accept this partnership invite (currently ${signedInEmail || "unknown"}).`,
    );
  }

  const pilot =
    invite.pilot_partnerships as unknown as Database["public"]["Tables"]["pilot_partnerships"]["Row"];
  let organizationId = pilot.organization_id;
  if (!organizationId) {
    const slug = `${slugifyPartnerName(pilot.partner_name)}-${randomTokenHex(2)}`;
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: pilot.partner_name,
        slug,
        type: partnerTypeToOrgType(pilot.partner_type as never),
        email: pilot.primary_contact_email,
        phone: pilot.primary_contact_phone,
      })
      .select("id")
      .single();
    if (orgError) throw orgError;
    organizationId = org.id;
  }
  await ensureOrgMembership(admin, organizationId, userId, "owner");

  const { data: existingRoles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const owned = new Set((existingRoles ?? []).map((r) => r.role));
  for (const role of partnerTypeToAppRoles(pilot.partner_type as never)) {
    if (!owned.has(role)) {
      await admin.from("user_roles").insert({ user_id: userId, role });
    }
  }

  const now = touchUpdated();
  await admin
    .from("pilot_partnerships")
    .update({
      organization_id: organizationId,
      status: "ACTIVE",
      approved_at: pilot.approved_at ?? now,
      approved_by: pilot.approved_by ?? pilot.created_by ?? null,
      primary_contact_email: pilot.primary_contact_email ?? signedInEmail,
      updated_at: now,
    })
    .eq("id", pilot.id);

  await admin
    .from("pilot_invitations")
    .update({
      status: "ACCEPTED",
      accepted_at: now,
      accepted_by: userId,
    })
    .eq("id", invite.id);

  const displayName =
    pilot.partner_name &&
    !pilot.partner_name.startsWith("Partner invite") &&
    !/^pending/i.test(pilot.partner_name)
      ? pilot.partner_name
      : signedInEmail;

  void notifyAdminsPilotAlert(admin, {
    title: "Partner joined the pilot",
    body: `${displayName} accepted their invitation and now has dashboard access.`,
    href: `/admin/partnerships/${pilot.id}`,
    email: true,
  }).catch(() => undefined);

  void notifyPilotEvent(admin, {
    userIds: [userId],
    title: "Welcome to your partner pilot",
    body: "Your dashboard is ready. Add a few company details whenever you like — nothing blocks you.",
    href: "/partner",
  }).catch(() => undefined);

  return { pilotId: pilot.id, organizationId, status: "ACTIVE" as const };
}

function recommendPilotOutcome(totals: { enquiries: number; views: number }): string {
  if (totals.enquiries >= 20 || totals.views >= 1000) {
    return "CONVERT TO LONG-TERM PARTNERSHIP";
  }
  if (totals.views >= 300) return "EXTEND PILOT";
  return "REVISE PILOT";
}

function existingOnboardingRecord(onboarding: Json | null | undefined): Record<string, unknown> {
  if (onboarding && typeof onboarding === "object" && !Array.isArray(onboarding)) {
    return onboarding as Record<string, unknown>;
  }
  return {};
}

function applyOrganizationOnboardingStep(input: {
  pilot: Database["public"]["Tables"]["pilot_partnerships"]["Row"];
  payload: Record<string, string>;
  updates: Database["public"]["Tables"]["pilot_partnerships"]["Update"];
  orgPatch: Database["public"]["Tables"]["organizations"]["Update"];
}): void {
  const { pilot, payload: p, updates, orgPatch } = input;
  if (p.name?.trim()) {
    updates.partner_name = p.name.trim();
    if (
      !pilot.public_slug ||
      /^partner-/i.test(pilot.public_slug) ||
      /^pending/i.test(pilot.partner_name)
    ) {
      updates.public_slug = `${slugifyPartnerName(p.name) || "partner"}-${randomTokenHex(2)}`;
    }
  }
  if (p.partnerType && PILOT_PARTNER_TYPES.includes(p.partnerType as never)) {
    updates.partner_type = p.partnerType;
  }
  if (!pilot.organization_id) return;
  if (p.name) orgPatch.name = p.name;
  if (p.description !== undefined) orgPatch.description = p.description;
  if (p.website !== undefined) orgPatch.website = p.website;
  if (p.email !== undefined) orgPatch.email = p.email;
  if (p.phone !== undefined) orgPatch.phone = p.phone;
  if (p.officeLocation !== undefined) orgPatch.office_location = p.officeLocation;
  if (p.logoUrl !== undefined) orgPatch.logo_url = p.logoUrl;
}

function applyContactsOnboardingStep(
  payload: Record<string, string>,
  updates: Database["public"]["Tables"]["pilot_partnerships"]["Update"],
): void {
  if (payload.primaryContactName !== undefined) {
    updates.primary_contact_name = payload.primaryContactName || null;
  }
  if (payload.primaryContactEmail?.trim()) {
    updates.primary_contact_email = payload.primaryContactEmail.trim().toLowerCase();
  }
  if (payload.primaryContactPhone !== undefined) {
    updates.primary_contact_phone = payload.primaryContactPhone || null;
  }
}

function markOnboardingComplete(input: {
  pilot: Database["public"]["Tables"]["pilot_partnerships"]["Row"];
  onboarding: Record<string, unknown>;
  updates: Database["public"]["Tables"]["pilot_partnerships"]["Update"];
}): void {
  const { pilot, onboarding, updates } = input;
  onboarding.completedAt = touchUpdated();
  updates.onboarding = onboarding as Json;
  if (pilot.status === "APPROVED" || pilot.status === "ONBOARDING" || pilot.status === "INVITED") {
    updates.status = "ACTIVE";
    updates.approved_at = pilot.approved_at ?? touchUpdated();
  }
}

export const savePilotOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      pilotId: z.string().uuid(),
      step: z.enum(["organization", "contacts", "portfolio", "objectives", "criteria"]),
      payload: z.record(z.unknown()),
      complete: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const admin = await adminDb();
    const { pilot } = await assertPilotOrgAccess(admin, userId, data.pilotId);

    const onboarding = {
      ...existingOnboardingRecord(pilot.onboarding),
      [data.step]: data.payload,
      updatedAt: touchUpdated(),
    };

    const orgPatch: Database["public"]["Tables"]["organizations"]["Update"] = {};
    const updates: Database["public"]["Tables"]["pilot_partnerships"]["Update"] = {
      onboarding: onboarding as Json,
      updated_at: touchUpdated(),
    };

    if (data.step === "organization") {
      applyOrganizationOnboardingStep({
        pilot,
        payload: data.payload as Record<string, string>,
        updates,
        orgPatch,
      });
      if (pilot.organization_id && Object.keys(orgPatch).length) {
        await admin.from("organizations").update(orgPatch).eq("id", pilot.organization_id);
      }
    }

    if (data.step === "contacts") {
      applyContactsOnboardingStep(data.payload as Record<string, string>, updates);
    }

    if (data.step === "objectives") {
      const items = (data.payload as { items?: string[] }).items;
      if (Array.isArray(items)) updates.objectives = items as unknown as Json;
    }

    if (data.complete) {
      markOnboardingComplete({ pilot, onboarding, updates });
      const name = (updates.partner_name as string | undefined) ?? pilot.partner_name;
      void notifyAdminsPilotAlert(admin, {
        title: "Partner updated pilot profile",
        body: `${name} saved their company details.`,
        href: `/admin/partnerships/${pilot.id}`,
        email: true,
      }).catch(() => undefined);
    }

    const { data: updated, error } = await admin
      .from("pilot_partnerships")
      .update(updates)
      .eq("id", data.pilotId)
      .select("*")
      .single();
    if (error) throw error;
    return updated;
  });

export const addPilotProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      pilotId: z.string().uuid(),
      propertyId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const admin = await adminDb();
    const { pilot, isAdmin } = await assertPilotOrgAccess(admin, userId, data.pilotId);

    const { data: property } = await admin
      .from("properties")
      .select("id, owner_id, organization_id")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (!property) throw new Error("Property not found");

    if (!isAdmin) {
      const owns =
        property.owner_id === userId ||
        (Boolean(pilot.organization_id) && property.organization_id === pilot.organization_id);
      if (!owns) {
        throw new Error(
          "You can only add properties you own or that belong to your partner organization",
        );
      }
    }

    const pilotLive =
      pilot.status === "ACTIVE" || pilot.status === "EXTENDED" || pilot.status === "CONVERTED";
    // Partners with an active invite window go live immediately — no review queue.
    const nextStatus = isAdmin || pilotLive ? "LIVE" : "UNDER_REVIEW";
    const { data: row, error } = await admin
      .from("pilot_properties")
      .upsert(
        {
          pilot_id: data.pilotId,
          property_id: data.propertyId,
          status: nextStatus,
          approved_at: nextStatus === "LIVE" ? touchUpdated() : null,
          removed_at: null,
        },
        { onConflict: "pilot_id,property_id" },
      )
      .select("*")
      .single();
    if (error) throw error;

    if (nextStatus === "LIVE" && !isAdmin) {
      void notifyAdminsPilotAlert(admin, {
        title: "Pilot property added",
        body: `${pilot.partner_name} linked a listing to their pilot (now live).`,
        href: `/admin/partnerships/${pilot.id}`,
        email: false,
      }).catch(() => undefined);
    }

    return row;
  });

export const reviewPilotProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      pilotPropertyId: z.string().uuid(),
      action: z.enum(["approve", "reject", "live", "pause", "remove"]),
      reason: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = await adminDb();

    const statusMap = {
      approve: "APPROVED",
      reject: "PENDING",
      live: "LIVE",
      pause: "PAUSED",
      remove: "REMOVED",
    } as const;

    const patch: Database["public"]["Tables"]["pilot_properties"]["Update"] = {
      status: statusMap[data.action],
      notes: data.reason ?? null,
    };
    if (data.action === "approve" || data.action === "live") {
      patch.approved_at = touchUpdated();
      if (data.action === "approve") patch.status = "LIVE";
    }
    if (data.action === "remove") patch.removed_at = touchUpdated();
    if (data.action === "reject") {
      patch.status = "PENDING";
      patch.rejection_reason = data.reason ?? "Please update listing details and resubmit.";
    }

    const { data: row, error } = await admin
      .from("pilot_properties")
      .update(patch)
      .eq("id", data.pilotPropertyId)
      .select("*, pilot_partnerships(organization_id, partner_name)")
      .single();
    if (error) throw error;
    const pilotMeta = row.pilot_partnerships as unknown as {
      organization_id: string | null;
      partner_name: string;
    } | null;
    void notifyPilotOrgMembers(admin, pilotMeta?.organization_id, {
      title: `Property ${data.action}`,
      body: `A pilot listing for ${pilotMeta?.partner_name ?? "your partnership"} was updated (${row.status}).`,
      href: "/partner/properties",
    }).catch(() => undefined);
    return row;
  });

export const updatePilotLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      leadId: z.string().uuid(),
      status: z.enum(PILOT_LEAD_STATUSES),
      notes: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const admin = await adminDb();
    const { data: lead } = await admin
      .from("pilot_leads")
      .select("id, pilot_id")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) throw new Error("Lead not found");
    await assertPilotOrgAccess(admin, userId, lead.pilot_id);
    const { data: updated, error } = await admin
      .from("pilot_leads")
      .update({
        status: data.status,
        notes: data.notes ?? null,
        updated_at: touchUpdated(),
      })
      .eq("id", data.leadId)
      .select("*")
      .single();
    if (error) throw error;
    return updated;
  });

export const addPilotActivityNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      pilotId: z.string().uuid(),
      body: z.string().trim().min(1).max(4000),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const admin = await adminDb();
    const { isAdmin } = await assertPilotOrgAccess(admin, userId, data.pilotId);
    const { data: note, error } = await admin
      .from("pilot_activity_notes")
      .insert({
        pilot_id: data.pilotId,
        author_id: userId,
        author_role: isAdmin ? "admin" : "partner",
        body: data.body,
      })
      .select("*")
      .single();
    if (error) throw error;
    return note;
  });

export const listMyPilots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const admin = await adminDb();
    const ids = await listUserPilotIds(admin, userId);
    if (!ids.length) return [];
    const { data, error } = await admin
      .from("pilot_partnerships")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((pilot) => ({
      ...pilot,
      daysRemaining: daysRemaining(pilot.pilot_end_date),
    }));
  });

export const recordPilotAnalyticsEventFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      propertyId: z.string().uuid().optional(),
      pilotId: z.string().uuid().optional(),
      eventType: z.enum(PILOT_EVENT_TYPES),
      sessionId: z.string().trim().max(128).optional(),
      source: z.string().trim().max(64).optional(),
      metadata: z.record(z.unknown()).optional(),
      createLead: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    const key = rateLimitKeyFromHeaders(request?.headers);
    const rate = await rateLimitDistributed(`pilot-event:${key}`, {
      max: 120,
      windowMs: 60_000,
    });
    if (rate.limited) return { ok: false as const, reason: "rate_limited" };

    let userId: string | null = null;
    const authHeader = request?.headers?.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const url = process.env.SUPABASE_URL;
      const keyPub = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (url && keyPub) {
        const client = createClient<Database>(url, keyPub, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims } = await client.auth.getClaims(token);
        userId = claims?.claims?.sub ?? null;
      }
    }

    const admin = await adminDb();
    const result = await recordPilotEvent(admin, {
      propertyId: data.propertyId,
      pilotId: data.pilotId,
      eventType: data.eventType,
      userId,
      sessionId: data.sessionId,
      source: data.source,
      metadata: data.metadata,
      createLead: data.createLead,
    });
    return { ok: true as const, ...result };
  });

export const getPublicPartnerProfile = createServerFn({ method: "POST" })
  .inputValidator(z.object({ slug: z.string().trim().min(2).max(80) }))
  .handler(async ({ data }) => {
    const admin = await adminDb();
    const slug = data.slug.trim().toLowerCase();
    const { data: pilot, error } = await admin
      .from("pilot_partnerships")
      .select("*, organizations(*)")
      .eq("public_slug", slug)
      .in("status", ["INVITED", "ONBOARDING", "APPROVED", "ACTIVE", "EXTENDED", "CONVERTED"])
      .maybeSingle();
    if (error) throw error;
    if (!pilot) return null;

    const liveStatuses = new Set(["ACTIVE", "EXTENDED", "CONVERTED"]);
    const isLive = liveStatuses.has(pilot.status);
    const { data: properties } = isLive
      ? await admin
          .from("pilot_properties")
          .select("property_id, properties(*)")
          .eq("pilot_id", pilot.id)
          .eq("status", "LIVE")
      : { data: [] as { property_id: string; properties: unknown }[] };

    const activeProperties = (properties ?? [])
      .map((row) => row.properties)
      .filter((p): p is Record<string, unknown> => {
        if (!p || typeof p !== "object") return false;
        return (p as { is_active?: boolean }).is_active !== false;
      });

    return {
      pilot: {
        id: pilot.id,
        partnerName: pilot.partner_name,
        partnerType: pilot.partner_type,
        publicSlug: pilot.public_slug,
        showPartnerBadge: pilot.show_partner_badge,
        status: pilot.status,
      },
      organization: pilot.organizations,
      properties: activeProperties,
      pending: !isLive,
    };
  });

export const getPilotReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ pilotId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const admin = await adminDb();
    await assertPilotOrgAccess(admin, userId, data.pilotId);
    const detail = await loadPilotDetail(admin, data.pilotId);
    const topProperties = [...(detail.properties ?? [])].slice(0, 10).map((p) => ({
      id: p.property_id,
      title: (p.properties as { title?: string } | null)?.title ?? "Property",
      status: p.status,
    }));

    const recommendation = recommendPilotOutcome(detail.totals);

    return {
      generatedAt: new Date().toISOString(),
      partnerName: detail.pilot.partner_name,
      period: {
        start: detail.pilot.pilot_start_date,
        end: detail.pilot.pilot_end_date,
      },
      status: detail.pilot.status,
      totals: detail.totals,
      kpis: detail.kpis,
      funnel: detail.funnel,
      topProperties,
      leadBreakdown: Object.entries(
        (detail.leads ?? []).reduce<Record<string, number>>((acc, lead) => {
          acc[lead.lead_type] = (acc[lead.lead_type] ?? 0) + 1;
          return acc;
        }, {}),
      ).map(([type, count]) => ({ type, count })),
      recommendation,
      philosophy:
        "We prove the value first, measure the results, and build the long-term partnership around what works.",
    };
  });

const crmProspectSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  contactPerson: z.string().trim().max(120).optional(),
  position: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  companyType: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
  pipelineStatus: z.enum(CRM_PIPELINE_STATUSES).default("PROSPECT"),
  notes: z.string().trim().max(4000).optional(),
  nextFollowUpAt: z.string().datetime().optional(),
});

export const upsertCrmProspect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(crmProspectSchema.extend({ id: z.string().uuid().optional() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = await adminDb();
    const payload = {
      company_name: data.companyName,
      contact_person: data.contactPerson ?? null,
      position: data.position ?? null,
      phone: data.phone ?? null,
      email: data.email || null,
      website: data.website || null,
      company_type: data.companyType ?? null,
      location: data.location ?? null,
      pipeline_status: data.pipelineStatus,
      notes: data.notes ?? null,
      next_follow_up_at: data.nextFollowUpAt ?? null,
      assigned_staff_id: userId,
      updated_at: touchUpdated(),
    };
    if (data.id) {
      const { data: row, error } = await admin
        .from("partner_crm_prospects")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await admin
      .from("partner_crm_prospects")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const listCrmProspects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = await adminDb();
    const { data, error } = await admin
      .from("partner_crm_prospects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const counts = CRM_PIPELINE_STATUSES.reduce<Record<string, number>>((acc, status) => {
      acc[status] = (data ?? []).filter((p) => p.pipeline_status === status).length;
      return acc;
    }, {});
    return { prospects: data ?? [], counts };
  });

export const addCrmFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      prospectId: z.string().uuid(),
      followUpAt: z.string().datetime(),
      method: z.enum(["whatsapp", "email", "call", "meeting", "other"]).default("whatsapp"),
      notes: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const admin = await adminDb();
    const { data: row, error } = await admin
      .from("partner_crm_followups")
      .insert({
        prospect_id: data.prospectId,
        follow_up_at: data.followUpAt,
        method: data.method,
        notes: data.notes ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    await admin
      .from("partner_crm_prospects")
      .update({
        next_follow_up_at: data.followUpAt,
        last_contacted_at: touchUpdated(),
        updated_at: touchUpdated(),
      })
      .eq("id", data.prospectId);
    return row;
  });

export const getPartnerBadgeForProperties = createServerFn({ method: "POST" })
  .inputValidator(z.object({ propertyIds: z.array(z.string().uuid()).max(100) }))
  .handler(async ({ data }) => {
    if (!data.propertyIds.length)
      return {} as Record<string, { partnerName: string; slug: string }>;
    const admin = await adminDb();
    const { data: rows } = await admin
      .from("pilot_properties")
      .select(
        "property_id, approved_at, added_at, pilot_partnerships!inner(partner_name, public_slug, status, show_partner_badge)",
      )
      .in("property_id", data.propertyIds)
      .eq("status", "LIVE")
      .eq("pilot_partnerships.show_partner_badge", true)
      .in("pilot_partnerships.status", ["ACTIVE", "EXTENDED", "CONVERTED"]);

    const map: Record<string, { partnerName: string; slug: string; approvedAt: string }> = {};
    for (const row of rows ?? []) {
      const pilot = row.pilot_partnerships as unknown as {
        partner_name: string;
        public_slug: string | null;
        status: string;
        show_partner_badge: boolean;
      };
      if (!pilot.public_slug) continue;
      const stamp = row.approved_at ?? row.added_at;
      const existing = map[row.property_id];
      if (!existing || new Date(stamp).getTime() > new Date(existing.approvedAt).getTime()) {
        map[row.property_id] = {
          partnerName: pilot.partner_name,
          slug: pilot.public_slug,
          approvedAt: stamp,
        };
      }
    }
    return Object.fromEntries(
      Object.entries(map).map(([id, value]) => [
        id,
        { partnerName: value.partnerName, slug: value.slug },
      ]),
    );
  });

