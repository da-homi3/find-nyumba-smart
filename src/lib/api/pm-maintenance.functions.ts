import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { adminClient, authContext } from "@/lib/api/nyumba/nyumba-shared";
import { asPmDb, assertPmPropertyAccess, assertStaffCan } from "@/lib/pm/access";
import {
  canTransition,
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_PRIORITIES,
  providerCategoryForMaintenance,
} from "@/lib/maintenance/state-machine";
import {
  buildProviderWhatsAppUrl,
  notifyOwnerProviderDecision,
  promptTenantConfirmation,
} from "@/lib/maintenance/notify";
import { getSiteUrl } from "@/lib/site";
import { timingSafeEqual } from "@/lib/security/timing-safe-equal";

const PORTAL_ROLES = ["landlord", "agency", "manager"] as const;

async function requirePortalRole(supabase: Parameters<typeof requireRole>[0], userId: string) {
  await requireRole(supabase, userId, [...PORTAL_ROLES]);
}

const categorySchema = z.enum(MAINTENANCE_CATEGORIES);
const prioritySchema = z.enum(MAINTENANCE_PRIORITIES);
const statusSchema = z.enum([
  "reported",
  "assigned",
  "accepted",
  "in_progress",
  "completed",
  "confirmed",
]);

async function loadRequestWithProperty(admin: ReturnType<typeof asPmDb>, requestId: string) {
  const { data: request } = await admin
    .from("pm_maintenance_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) throw new Error("Maintenance request not found");

  const { data: unit } = await admin
    .from("pm_units")
    .select("id, unit_label, property_id")
    .eq("id", request.unit_id)
    .maybeSingle();
  if (!unit) throw new Error("Unit not found");

  return { request, unit };
}

export const listPmMaintenanceRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { userId, supabase } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);
    assertStaffCan(staffRole, "maintenance:*");

    const { data: units } = await admin
      .from("pm_units")
      .select("id, unit_label")
      .eq("property_id", data.propertyId);
    const unitIds = (units ?? []).map((u: { id: string }) => u.id);
    if (!unitIds.length) return { requests: [], propertyCounty: null as string | null };

    const { data: property } = await admin
      .from("pm_properties")
      .select("neighborhood")
      .eq("id", data.propertyId)
      .maybeSingle();

    const { data: rows } = await admin
      .from("pm_maintenance_requests")
      .select("*")
      .in("unit_id", unitIds)
      .order("created_at", { ascending: false });

    const unitLabel = new Map(
      (units ?? []).map((u: { id: string; unit_label: string }) => [u.id, u.unit_label]),
    );

    const providerIds = [
      ...new Set(
        (rows ?? [])
          .map((r: { assigned_provider_id: string | null }) => r.assigned_provider_id)
          .filter(Boolean),
      ),
    ] as string[];
    const providerName = new Map<string, string>();
    if (providerIds.length) {
      const { data: providers } = await admin
        .from("service_providers")
        .select("id, business_name")
        .in("id", providerIds);
      for (const p of providers ?? []) {
        providerName.set(p.id, p.business_name);
      }
    }

    return {
      propertyCounty: (property?.neighborhood as string | undefined) ?? null,
      requests: (rows ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        category: r.category as string,
        description: r.description as string,
        priority: r.priority as string,
        status: r.status as string,
        photos: (r.photos as string[]) ?? [],
        unit_id: r.unit_id as string,
        unit_label: unitLabel.get(r.unit_id as string) ?? "—",
        assigned_provider_id: (r.assigned_provider_id as string | null) ?? null,
        assigned_provider_name: r.assigned_provider_id
          ? (providerName.get(r.assigned_provider_id as string) ?? null)
          : null,
        created_at: r.created_at as string,
        completed_at: (r.completed_at as string | null) ?? null,
      })),
    };
  });

export const listProvidersForMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyId: z.string().uuid(),
      category: categorySchema,
      county: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId, supabase } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);
    assertStaffCan(staffRole, "maintenance:*");

    const providerCat = providerCategoryForMaintenance(data.category);
    let query = admin
      .from("service_providers")
      .select(
        "id, business_name, categories, counties, price_range, phone, verified, tier, description",
      )
      .eq("status", "active")
      .filter("categories", "cs", JSON.stringify([providerCat]))
      .limit(40);

    const { data: rows, error } = await query;
    if (error) throw error;

    const countyHint = data.county?.trim().toLowerCase();
    const mapped = (rows ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      businessName: row.business_name as string,
      categories: (row.categories as string[]) ?? [],
      counties: (row.counties as string[]) ?? [],
      priceRange: (row.price_range as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      verified: Boolean(row.verified),
      tier: (row.tier as string | null) ?? null,
      description: (row.description as string | null) ?? null,
    }));

    if (!countyHint) return { providers: mapped, providerCategory: providerCat };

    const filtered = mapped.filter((p) =>
      p.counties.some(
        (c) => c.toLowerCase().includes(countyHint) || countyHint.includes(c.toLowerCase()),
      ),
    );
    // Prefer county matches; fall back to all category matches so landlords aren't stuck
    return {
      providers: filtered.length ? filtered : mapped,
      providerCategory: providerCat,
      countyFiltered: filtered.length > 0,
    };
  });

export const assignPmMaintenanceProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      requestId: z.string().uuid(),
      providerId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId, supabase } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { request, unit } = await loadRequestWithProperty(admin, data.requestId);
    const { staffRole } = await assertPmPropertyAccess(admin, userId, unit.property_id);
    assertStaffCan(staffRole, "maintenance:*");

    if (!canTransition(request.status, "assigned")) {
      throw new Error(`Cannot assign — request is currently ${request.status}`);
    }

    const { data: provider } = await admin
      .from("service_providers")
      .select("id, business_name, phone")
      .eq("id", data.providerId)
      .maybeSingle();
    if (!provider) throw new Error("Service provider not found");

    const token = crypto.randomUUID();
    const { error } = await admin
      .from("pm_maintenance_requests")
      .update({
        status: "assigned",
        assigned_provider_id: data.providerId,
        provider_response_token: token,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (error) throw error;

    const site = getSiteUrl();
    const acceptUrl = `${site}/api/maintenance/respond?id=${data.requestId}&token=${token}&action=accept`;
    const declineUrl = `${site}/api/maintenance/respond?id=${data.requestId}&token=${token}&action=decline`;
    const waUrl = buildProviderWhatsAppUrl({
      phone: provider.phone,
      category: request.category,
      description: request.description,
      acceptUrl,
      declineUrl,
    });

    return {
      success: true,
      providerWhatsAppUrl: waUrl,
      acceptUrl,
      declineUrl,
      providerName: provider.business_name,
    };
  });

export const updatePmMaintenanceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      requestId: z.string().uuid(),
      status: statusSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId, supabase } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { request, unit } = await loadRequestWithProperty(admin, data.requestId);
    const { staffRole } = await assertPmPropertyAccess(admin, userId, unit.property_id);
    assertStaffCan(staffRole, "maintenance:*");

    if (!canTransition(request.status, data.status)) {
      throw new Error(`Cannot move from ${request.status} to ${data.status}`);
    }

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "completed") {
      patch.completed_at = new Date().toISOString();
    }
    if (data.status === "in_progress" && request.status === "completed") {
      patch.completed_at = null;
    }
    // Landlord self-start: reported → in_progress
    if (data.status === "in_progress" && request.status === "reported") {
      patch.assigned_at = new Date().toISOString();
    }

    const { error } = await admin
      .from("pm_maintenance_requests")
      .update(patch)
      .eq("id", data.requestId);
    if (error) throw error;

    if (data.status === "completed") {
      await promptTenantConfirmation(admin, data.requestId);
    }

    return { success: true, status: data.status };
  });

/** Public provider accept/decline — no auth; token required. */
export async function handleMaintenanceProviderRespond(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const requestId = url.searchParams.get("id") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const action = url.searchParams.get("action") ?? "";

  const html = (message: string, ok = true) =>
    new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>NyumbaSearch</title></head>
<body style="font-family:Manrope,system-ui,sans-serif;text-align:center;padding:60px 20px;background:#111827;color:#f8fafc">
  <h2 style="color:${ok ? "#1eb88a" : "#f87171"};max-width:28rem;margin:0 auto">${message}</h2>
  <p style="opacity:.6;margin-top:1rem;font-size:14px"><a href="${getSiteUrl()}" style="color:#ffd54f">nyumbasearch.com</a></p>
</body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );

  if (!requestId || !token || (action !== "accept" && action !== "decline")) {
    return html("Invalid link.", false);
  }

  const admin = asPmDb(await adminClient());
  const { data: request } = await admin
    .from("pm_maintenance_requests")
    .select("id, status, provider_response_token, category")
    .eq("id", requestId)
    .maybeSingle();

  if (
    !request?.provider_response_token ||
    !timingSafeEqual(request.provider_response_token, token)
  ) {
    return html("Invalid or expired link.", false);
  }

  if (action === "accept") {
    if (!canTransition(request.status, "accepted")) {
      return html("This job is no longer available for response.");
    }
    await admin
      .from("pm_maintenance_requests")
      .update({ status: "accepted", provider_response_token: null })
      .eq("id", requestId);
    notifyOwnerProviderDecision(admin, requestId, true).catch((err) => {
      console.warn("[maintenance] accept notify failed", err);
    });
    return html("Thanks — you've accepted this job. The landlord has been notified.");
  }

  // decline → back to reported
  if (!canTransition(request.status, "reported") && request.status !== "assigned") {
    return html("This job can no longer be declined.");
  }
  await admin
    .from("pm_maintenance_requests")
    .update({
      status: "reported",
      assigned_provider_id: null,
      provider_response_token: null,
      assigned_at: null,
    })
    .eq("id", requestId);
  notifyOwnerProviderDecision(admin, requestId, false).catch((err) => {
    console.warn("[maintenance] decline notify failed", err);
  });
  return html("No problem — the landlord has been notified and will assign someone else.");
}
