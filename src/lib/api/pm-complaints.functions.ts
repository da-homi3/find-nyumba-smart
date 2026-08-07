import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { adminClient, authContext } from "@/lib/api/nyumba/nyumba-shared";
import { asPmDb, assertPmPropertyAccess, assertStaffCan } from "@/lib/pm/access";
import { notifyOwnerNewComplaint, notifyTenantComplaintReply } from "@/lib/pm/complaints-notify";

const PORTAL_ROLES = ["landlord", "agency", "manager", "admin", "caretaker"] as const;

async function requirePortalRole(supabase: Parameters<typeof requireRole>[0], userId: string) {
  await requireRole(supabase, userId, [...PORTAL_ROLES]);
}

async function activeTenantLeaseContext(admin: ReturnType<typeof asPmDb>, userId: string) {
  const { data: tenants } = await admin
    .from("pm_tenants")
    .select("id, full_name, property_id")
    .eq("tenant_user_id", userId)
    .eq("portal_status", "accepted")
    .is("deleted_at", null);

  if (!tenants?.length) return null;

  const tenantIds = tenants.map((t: { id: string }) => t.id);
  const { data: leases } = await admin
    .from("pm_leases")
    .select("id, unit_id, tenant_id")
    .in("tenant_id", tenantIds)
    .eq("status", "active");

  if (!leases?.length) return null;

  const lease = leases[0] as { id: string; unit_id: string; tenant_id: string };
  const tenant = tenants.find((t: { id: string }) => t.id === lease.tenant_id) as
    | { id: string; full_name: string; property_id: string }
    | undefined;
  if (!tenant) return null;

  const { data: unit } = await admin
    .from("pm_units")
    .select("id, unit_label, property_id")
    .eq("id", lease.unit_id)
    .maybeSingle();
  if (!unit) return null;

  return { lease, tenant, unit };
}

function mapComplaintRow(
  r: Record<string, unknown>,
  extras?: {
    unit_label?: string | null;
    property_name?: string | null;
    tenant_name?: string | null;
  },
) {
  return {
    id: r.id as string,
    property_id: r.property_id as string,
    unit_id: r.unit_id as string,
    tenant_id: r.tenant_id as string,
    lease_id: (r.lease_id as string | null) ?? null,
    subject: r.subject as string,
    body: r.body as string,
    photo_url: (r.photo_url as string | null) ?? null,
    status: r.status as string,
    seen_at: (r.seen_at as string | null) ?? null,
    landlord_reply: (r.landlord_reply as string | null) ?? null,
    replied_at: (r.replied_at as string | null) ?? null,
    created_at: r.created_at as string,
    unit_label: extras?.unit_label ?? null,
    property_name: extras?.property_name ?? null,
    tenant_name: extras?.tenant_name ?? null,
  };
}

export const listMyPmComplaints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = authContext(context);
    const admin = asPmDb(await adminClient());

    const { data: tenants } = await admin
      .from("pm_tenants")
      .select("id")
      .eq("tenant_user_id", userId)
      .eq("portal_status", "accepted")
      .is("deleted_at", null);

    if (!tenants?.length) return [];

    const tenantIds = tenants.map((t: { id: string }) => t.id);
    const { data: rows } = await admin
      .from("pm_complaints")
      .select("*")
      .in("tenant_id", tenantIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const unitIds = [...new Set((rows ?? []).map((r: { unit_id: string }) => r.unit_id))];
    const { data: units } = unitIds.length
      ? await admin.from("pm_units").select("id, unit_label, property_id").in("id", unitIds)
      : { data: [] };

    const propertyIds = [
      ...new Set((units ?? []).map((u: { property_id: string }) => u.property_id)),
    ];
    const { data: properties } = propertyIds.length
      ? await admin.from("pm_properties").select("id, name").in("id", propertyIds)
      : { data: [] };

    const unitById = new Map(
      (units ?? []).map((u: { id: string; unit_label: string; property_id: string }) => [u.id, u]),
    );
    const propById = new Map(
      (properties ?? []).map((p: { id: string; name: string }) => [p.id, p]),
    );

    return (rows ?? []).map((r: Record<string, unknown>) => {
      const unit = unitById.get(r.unit_id as string);
      const property = unit ? propById.get(unit.property_id) : undefined;
      return mapComplaintRow(r, {
        unit_label: unit?.unit_label ?? null,
        property_name: property?.name ?? null,
      });
    });
  });

export const createPmComplaint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      subject: z
        .string()
        .trim()
        .min(3, "Subject must be at least 3 characters")
        .max(120, "Subject is too long"),
      body: z
        .string()
        .trim()
        .min(5, "Please describe the issue in a bit more detail (at least 5 characters)")
        .max(4000, "Details are too long"),
      photoUrl: z.string().url().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = authContext(context);
    const admin = asPmDb(await adminClient());
    const ctx = await activeTenantLeaseContext(admin, userId);
    if (!ctx) throw new Error("No active lease found for this account");

    const { data: inserted, error } = await admin
      .from("pm_complaints")
      .insert({
        property_id: ctx.unit.property_id,
        unit_id: ctx.lease.unit_id,
        tenant_id: ctx.tenant.id,
        lease_id: ctx.lease.id,
        subject: data.subject,
        body: data.body,
        photo_url: data.photoUrl ?? null,
        status: "open",
      })
      .select("id")
      .single();

    if (error) throw error;

    try {
      await notifyOwnerNewComplaint(admin, inserted.id);
    } catch (err) {
      console.warn("[complaints] owner notify failed", err);
    }

    return { complaintId: inserted.id as string };
  });

export const listPmComplaints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);
    assertStaffCan(staffRole, "complaints:view");

    const { data: rows, error } = await admin
      .from("pm_complaints")
      .select("*")
      .eq("property_id", data.propertyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const unitIds = [...new Set((rows ?? []).map((r: { unit_id: string }) => r.unit_id))];
    const tenantIds = [...new Set((rows ?? []).map((r: { tenant_id: string }) => r.tenant_id))];

    const { data: units } = unitIds.length
      ? await admin.from("pm_units").select("id, unit_label").in("id", unitIds)
      : { data: [] };
    const { data: tenants } = tenantIds.length
      ? await admin.from("pm_tenants").select("id, full_name").in("id", tenantIds)
      : { data: [] };

    const unitById = new Map(
      (units ?? []).map((u: { id: string; unit_label: string }) => [u.id, u]),
    );
    const tenantById = new Map(
      (tenants ?? []).map((t: { id: string; full_name: string }) => [t.id, t]),
    );

    return {
      complaints: (rows ?? []).map((r: Record<string, unknown>) =>
        mapComplaintRow(r, {
          unit_label: unitById.get(r.unit_id as string)?.unit_label ?? null,
          tenant_name: tenantById.get(r.tenant_id as string)?.full_name ?? null,
        }),
      ),
    };
  });

export const markPmComplaintSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ complaintId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());

    const { data: row } = await admin
      .from("pm_complaints")
      .select("id, property_id, status")
      .eq("id", data.complaintId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!row) throw new Error("Complaint not found");

    const { staffRole } = await assertPmPropertyAccess(admin, userId, row.property_id);
    assertStaffCan(staffRole, "complaints:*");

    if (row.status === "open") {
      const { error } = await admin
        .from("pm_complaints")
        .update({
          status: "seen",
          seen_at: new Date().toISOString(),
          seen_by: userId,
        })
        .eq("id", data.complaintId);
      if (error) throw error;
    } else if (!row.status || row.status === "seen") {
      // already seen / replied — ensure seen_at
      await admin
        .from("pm_complaints")
        .update({
          seen_at: new Date().toISOString(),
          seen_by: userId,
        })
        .eq("id", data.complaintId)
        .is("seen_at", null);
    }

    return { success: true as const };
  });

export const replyToPmComplaint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      complaintId: z.string().uuid(),
      reply: z.string().trim().min(1).max(4000),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());

    const { data: row } = await admin
      .from("pm_complaints")
      .select("id, property_id, status, seen_at")
      .eq("id", data.complaintId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!row) throw new Error("Complaint not found");

    const { staffRole } = await assertPmPropertyAccess(admin, userId, row.property_id);
    assertStaffCan(staffRole, "complaints:*");

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      landlord_reply: data.reply,
      replied_at: now,
      replied_by: userId,
      status: "replied",
    };
    if (!row.seen_at) {
      patch.seen_at = now;
      patch.seen_by = userId;
    }

    const { error } = await admin.from("pm_complaints").update(patch).eq("id", data.complaintId);
    if (error) throw error;

    notifyTenantComplaintReply(admin, data.complaintId, data.reply).catch((err) => {
      console.warn("[complaints] tenant reply notify failed", err);
    });

    return { success: true as const };
  });
