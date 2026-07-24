import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminClient, authContext } from "@/lib/api/nyumba/nyumba-shared";
import { asPmDb } from "@/lib/pm/access";
import {
  canTransition,
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_PRIORITIES,
} from "@/lib/maintenance/state-machine";
import { notifyOwnerNewMaintenance } from "@/lib/maintenance/notify";

const categorySchema = z.enum(MAINTENANCE_CATEGORIES);
const prioritySchema = z.enum(MAINTENANCE_PRIORITIES);

async function activeTenantContext(admin: ReturnType<typeof asPmDb>, userId: string) {
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

  // Prefer the most recently created active lease
  const lease = leases[0] as { id: string; unit_id: string; tenant_id: string };
  const tenant = tenants.find((t: { id: string }) => t.id === lease.tenant_id);
  return { lease, tenant };
}

export const listTenantMaintenanceRequests = createServerFn({ method: "GET" })
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
      .from("pm_maintenance_requests")
      .select("*")
      .in("tenant_id", tenantIds)
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
      return {
        id: r.id as string,
        category: r.category as string,
        description: r.description as string,
        priority: r.priority as string,
        status: r.status as string,
        photos: (r.photos as string[]) ?? [],
        unit_label: unit?.unit_label ?? null,
        property_name: property?.name ?? null,
        created_at: r.created_at as string,
        completed_at: (r.completed_at as string | null) ?? null,
      };
    });
  });

export const createTenantMaintenanceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      category: categorySchema,
      priority: prioritySchema.default("normal"),
      description: z.string().trim().min(8).max(2000),
      photos: z.array(z.string().url()).max(5).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = authContext(context);
    const admin = asPmDb(await adminClient());
    const ctx = await activeTenantContext(admin, userId);
    if (!ctx?.tenant) {
      throw new Error("No active lease found for this account");
    }

    const { data: inserted, error } = await admin
      .from("pm_maintenance_requests")
      .insert({
        unit_id: ctx.lease.unit_id,
        tenant_id: ctx.tenant.id,
        category: data.category,
        priority: data.priority,
        description: data.description,
        photos: data.photos ?? [],
        status: "reported",
      })
      .select("id")
      .single();

    if (error) throw error;

    notifyOwnerNewMaintenance(admin, inserted.id).catch((err) => {
      console.warn("[maintenance] owner notify failed", err);
    });
    return { requestId: inserted.id as string };
  });

export const confirmTenantMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      requestId: z.string().uuid(),
      resolved: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = authContext(context);
    const admin = asPmDb(await adminClient());

    const { data: request } = await admin
      .from("pm_maintenance_requests")
      .select("id, status, tenant_id")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!request) throw new Error("Request not found");

    const { data: tenant } = await admin
      .from("pm_tenants")
      .select("id, tenant_user_id, portal_status")
      .eq("id", request.tenant_id)
      .maybeSingle();

    if (!tenant || tenant.tenant_user_id !== userId || tenant.portal_status !== "accepted") {
      throw new Error("Not authorised");
    }

    if (request.status !== "completed") {
      throw new Error("Only completed requests can be confirmed or reopened");
    }

    if (data.resolved) {
      if (!canTransition("completed", "confirmed")) {
        throw new Error("Invalid transition");
      }
      await admin
        .from("pm_maintenance_requests")
        .update({ status: "confirmed" })
        .eq("id", data.requestId);
      return { success: true, status: "confirmed" as const };
    }

    if (!canTransition("completed", "in_progress")) {
      throw new Error("Invalid transition");
    }
    await admin
      .from("pm_maintenance_requests")
      .update({ status: "in_progress", completed_at: null })
      .eq("id", data.requestId);
    return { success: true, status: "in_progress" as const };
  });
