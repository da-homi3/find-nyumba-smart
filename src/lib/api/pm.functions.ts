import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ForbiddenError, requireRole } from "@/lib/api/_authz";
import {
  adminClient,
  authContext,
  getUserOrganizationId,
} from "@/lib/api/nyumba/nyumba-shared";
import { sendEmail } from "@/lib/email/send";
import { tenantPortalInviteEmail } from "@/lib/email/templates";
import {
  asPmDb,
  assertPmPropertyAccess,
  assertStaffCan,
  type PmStaffRole,
} from "@/lib/pm/access";
import { recomputeInvoiceStatus } from "@/lib/pm/invoice-integrity";
import {
  bedroomsForUnitType,
  mapPmUnitTypeToListingType,
} from "@/lib/pm/invoice-status";
import { requirePmModuleSubscription } from "@/lib/pm/module-gate";
import {
  deletePmTenantInvite,
  readPmTenantInvite,
  storePmTenantInvite,
} from "@/lib/pm/invite-store";
import { getSiteUrl } from "@/lib/site";

const PORTAL_ROLES = ["landlord", "agency", "manager"] as const;

const propertyTypeSchema = z.enum([
  "apartment_block",
  "estate",
  "single_unit",
  "commercial",
  "mixed_use",
]);

const unitTypeSchema = z
  .enum(["bedsitter", "1br", "2br", "3br", "4br+", "commercial", "other"])
  .optional()
  .nullable();

const staffRoleSchema = z.enum([
  "owner",
  "property_manager",
  "caretaker",
  "security",
  "accountant",
  "maintenance_supervisor",
  "reception",
]);

async function requirePortalRole(supabase: Parameters<typeof requireRole>[0], userId: string) {
  await requireRole(supabase, userId, [...PORTAL_ROLES]);
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const normalized = email.trim().toLowerCase();

  // Prefer GoTrue email filter when available (avoids scanning thousands of users)
  try {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceKey) {
      const endpoint = new URL("/auth/v1/admin/users", url);
      endpoint.searchParams.set("page", "1");
      endpoint.searchParams.set("per_page", "50");
      endpoint.searchParams.set("email", normalized);
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      });
      if (res.ok) {
        const body = (await res.json()) as { users?: Array<{ id: string; email?: string }> };
        const match = (body.users ?? []).find((u) => u.email?.toLowerCase() === normalized);
        if (match) return match.id;
      }
    }
  } catch {
    // fall through to pagination
  }

  let page = 1;
  const perPage = 200;
  while (page <= 50) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match.id;
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

// ── Properties ────────────────────────────────────────────────────────────

export const listPmProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());

    const orgId = await getUserOrganizationId(supabase, userId);
    const { data: staffRows } = await admin
      .from("pm_property_staff")
      .select("property_id")
      .eq("user_id", userId);
    const staffIds = (staffRows ?? []).map((r: { property_id: string }) => r.property_id);

    let query = admin.from("pm_properties").select("*").is("deleted_at", null);
    const filters = [`owner_user_id.eq.${userId}`];
    if (orgId) filters.push(`agency_id.eq.${orgId}`);
    if (staffIds.length > 0) filters.push(`id.in.(${staffIds.join(",")})`);
    if (filters.length === 1) {
      query = query.eq("owner_user_id", userId);
    } else {
      query = query.or(filters.join(","));
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const createPmProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1).max(200),
      propertyType: propertyTypeSchema,
      address: z.string().trim().min(1).max(500),
      neighborhood: z.string().trim().min(1).max(200),
      lat: z.number().optional().nullable(),
      lng: z.number().optional().nullable(),
      photoUrl: z.string().url().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    await requirePmModuleSubscription(admin, userId);
    const orgId = await getUserOrganizationId(supabase, userId);

    const { data: row, error } = await admin
      .from("pm_properties")
      .insert({
        owner_user_id: userId,
        agency_id: orgId,
        name: data.name,
        property_type: data.propertyType,
        address: data.address,
        neighborhood: data.neighborhood,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        photo_url: data.photoUrl ?? null,
        status: "active",
        pm_module_active: true,
      })
      .select("*")
      .single();

    if (error) throw error;

    await admin.from("pm_property_staff").upsert(
      { property_id: row.id, user_id: userId, role: "owner" },
      { onConflict: "property_id,user_id" },
    );

    return row;
  });

export const getPmProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { property, staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);

    const [{ data: buildings }, { data: units }, { data: tenants }] = await Promise.all([
      admin
        .from("pm_buildings")
        .select("id, property_id, name, floor_count, created_at")
        .eq("property_id", data.propertyId)
        .order("name")
        .limit(200),
      admin
        .from("pm_units")
        .select(
          "id, property_id, building_id, unit_label, floor, unit_type, bedrooms, bathrooms, monthly_rent, deposit_amount, status, amenities, caretaker_name, caretaker_phone, linked_listing_id, created_at, updated_at",
        )
        .eq("property_id", data.propertyId)
        .is("deleted_at", null)
        .order("unit_label")
        .limit(1000),
      admin
        .from("pm_tenants")
        .select(
          "id, property_id, full_name, phone, email, national_id, emergency_contact_name, emergency_contact_phone, occupation, notes, tenant_user_id, portal_invited_at, portal_status, created_at",
        )
        .eq("property_id", data.propertyId)
        .is("deleted_at", null)
        .order("full_name")
        .limit(1000),
    ]);

    return {
      property,
      staffRole,
      buildings: buildings ?? [],
      units: units ?? [],
      tenants: tenants ?? [],
    };
  });

export const updatePmProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyId: z.string().uuid(),
      name: z.string().trim().min(1).max(200).optional(),
      address: z.string().trim().min(1).max(500).optional(),
      neighborhood: z.string().trim().min(1).max(200).optional(),
      status: z.enum(["active", "archived"]).optional(),
      lat: z.number().optional().nullable(),
      lng: z.number().optional().nullable(),
      photoUrl: z.string().url().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);
    assertStaffCan(staffRole, "units:*");

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.address !== undefined) patch.address = data.address;
    if (data.neighborhood !== undefined) patch.neighborhood = data.neighborhood;
    if (data.status !== undefined) patch.status = data.status;
    if (data.lat !== undefined) patch.lat = data.lat;
    if (data.lng !== undefined) patch.lng = data.lng;
    if (data.photoUrl !== undefined) patch.photo_url = data.photoUrl;

    const { data: row, error } = await admin
      .from("pm_properties")
      .update(patch)
      .eq("id", data.propertyId)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ── Buildings / units ─────────────────────────────────────────────────────

export const createPmBuilding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyId: z.string().uuid(),
      name: z.string().trim().min(1).max(120),
      floorCount: z.number().int().positive().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);
    assertStaffCan(staffRole, "units:create");

    const { data: row, error } = await admin
      .from("pm_buildings")
      .insert({
        property_id: data.propertyId,
        name: data.name,
        floor_count: data.floorCount ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const createPmUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyId: z.string().uuid(),
      buildingId: z.string().uuid().optional().nullable(),
      unitLabel: z.string().trim().min(1).max(80),
      floor: z.number().int().optional().nullable(),
      unitType: unitTypeSchema,
      bedrooms: z.number().int().min(0).optional().nullable(),
      bathrooms: z.number().int().min(0).optional().nullable(),
      monthlyRent: z.number().int().min(0),
      depositAmount: z.number().int().min(0).optional(),
      amenities: z.array(z.string()).optional(),
      caretakerName: z.string().optional().nullable(),
      caretakerPhone: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);
    assertStaffCan(staffRole, "units:create");

    const { data: row, error } = await admin
      .from("pm_units")
      .insert({
        property_id: data.propertyId,
        building_id: data.buildingId ?? null,
        unit_label: data.unitLabel,
        floor: data.floor ?? null,
        unit_type: data.unitType ?? null,
        bedrooms: data.bedrooms ?? null,
        bathrooms: data.bathrooms ?? null,
        monthly_rent: data.monthlyRent,
        deposit_amount: data.depositAmount ?? 0,
        amenities: data.amenities ?? [],
        caretaker_name: data.caretakerName ?? null,
        caretaker_phone: data.caretakerPhone ?? null,
        status: "vacant",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updatePmUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      unitId: z.string().uuid(),
      unitLabel: z.string().trim().min(1).max(80).optional(),
      floor: z.number().int().optional().nullable(),
      unitType: unitTypeSchema,
      bedrooms: z.number().int().min(0).optional().nullable(),
      bathrooms: z.number().int().min(0).optional().nullable(),
      monthlyRent: z.number().int().min(0).optional(),
      depositAmount: z.number().int().min(0).optional(),
      status: z
        .enum(["vacant", "occupied", "notice_given", "vacant_soon", "maintenance"])
        .optional(),
      amenities: z.array(z.string()).optional(),
      caretakerName: z.string().optional().nullable(),
      caretakerPhone: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());

    const { data: unit, error: unitErr } = await admin
      .from("pm_units")
      .select("*")
      .eq("id", data.unitId)
      .is("deleted_at", null)
      .maybeSingle();
    if (unitErr) throw unitErr;
    if (!unit) throw new Error("Unit not found");

    const { staffRole } = await assertPmPropertyAccess(admin, userId, unit.property_id);
    assertStaffCan(staffRole, "units:update");

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.unitLabel !== undefined) patch.unit_label = data.unitLabel;
    if (data.floor !== undefined) patch.floor = data.floor;
    if (data.unitType !== undefined) patch.unit_type = data.unitType;
    if (data.bedrooms !== undefined) patch.bedrooms = data.bedrooms;
    if (data.bathrooms !== undefined) patch.bathrooms = data.bathrooms;
    if (data.monthlyRent !== undefined) patch.monthly_rent = data.monthlyRent;
    if (data.depositAmount !== undefined) patch.deposit_amount = data.depositAmount;
    if (data.status !== undefined) patch.status = data.status;
    if (data.amenities !== undefined) patch.amenities = data.amenities;
    if (data.caretakerName !== undefined) patch.caretaker_name = data.caretakerName;
    if (data.caretakerPhone !== undefined) patch.caretaker_phone = data.caretakerPhone;

    const { data: row, error } = await admin
      .from("pm_units")
      .update(patch)
      .eq("id", data.unitId)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const publishPmUnitToMarketplace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ unitId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());

    const { data: unit, error: unitErr } = await admin
      .from("pm_units")
      .select("*")
      .eq("id", data.unitId)
      .is("deleted_at", null)
      .maybeSingle();
    if (unitErr) throw unitErr;
    if (!unit) throw new Error("Unit not found");
    if (unit.status !== "vacant") {
      throw new Error("Unit must be vacant to publish");
    }
    if (unit.linked_listing_id) {
      throw new Error("Unit already linked to a marketplace listing");
    }

    const { property, staffRole } = await assertPmPropertyAccess(admin, userId, unit.property_id);
    assertStaffCan(staffRole, "units:update");

    const propertyType = mapPmUnitTypeToListingType(unit.unit_type);
    const bedrooms = bedroomsForUnitType(unit.unit_type, unit.bedrooms);
    const amenities = Array.isArray(unit.amenities) ? unit.amenities : [];
    const title = `${String(unit.unit_type ?? "Unit").toUpperCase()} — ${property.name}, Unit ${unit.unit_label}`;

    const { data: listing, error: listErr } = await admin
      .from("properties")
      .insert({
        title,
        neighborhood: property.neighborhood,
        address: property.address,
        property_type: propertyType,
        bedrooms,
        bathrooms: unit.bathrooms ?? 1,
        rent_kes: unit.monthly_rent,
        deposit_kes: unit.deposit_amount ?? null,
        amenities,
        latitude: property.lat,
        longitude: property.lng,
        contact_phone: unit.caretaker_phone,
        contact_name: unit.caretaker_name,
        contact_phones: unit.caretaker_phone ? [unit.caretaker_phone] : [],
        owner_id: property.owner_user_id,
        organization_id: property.agency_id,
        is_active: true,
        is_vacant: true,
        pricing_mode: "rent",
        description: `Managed unit ${unit.unit_label} at ${property.name}.`,
      })
      .select("id")
      .single();

    if (listErr) throw listErr;

    const { error: linkErr } = await admin
      .from("pm_units")
      .update({
        linked_listing_id: listing.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.unitId);
    if (linkErr) throw linkErr;

    void import("@/lib/cache/manager")
      .then(({ invalidateListingCaches }) => invalidateListingCaches())
      .catch(() => undefined);

    return { listingId: listing.id as string };
  });

// ── Tenants / leases ──────────────────────────────────────────────────────

const tenantFieldsSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(5).max(40),
  email: z.string().email().optional().nullable(),
  nationalId: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  customFields: z
    .array(z.object({ label: z.string().max(100), value: z.string().max(500) }))
    .max(20)
    .optional()
    .nullable(),
});

export const addPmTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(tenantFieldsSchema.extend({ propertyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);
    assertStaffCan(staffRole, "tenants:create");

    const { data: row, error } = await admin
      .from("pm_tenants")
      .insert({
        property_id: data.propertyId,
        full_name: data.fullName,
        phone: data.phone,
        email: data.email ?? null,
        national_id: data.nationalId ?? null,
        emergency_contact_name: data.emergencyContactName ?? null,
        emergency_contact_phone: data.emergencyContactPhone ?? null,
        occupation: data.occupation ?? null,
        notes: data.notes ?? null,
        photo_url: data.photoUrl ?? null,
        custom_fields: JSON.stringify(data.customFields ?? []),
        portal_status: "not_invited",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updatePmTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(tenantFieldsSchema.extend({ tenantId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());

    const { data: tenant } = await admin
      .from("pm_tenants")
      .select("id, property_id")
      .eq("id", data.tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!tenant) throw new Error("Tenant not found");

    const { staffRole } = await assertPmPropertyAccess(admin, userId, tenant.property_id);
    assertStaffCan(staffRole, "tenants:create");

    const { error } = await admin
      .from("pm_tenants")
      .update({
        full_name: data.fullName,
        phone: data.phone,
        email: data.email ?? null,
        national_id: data.nationalId ?? null,
        emergency_contact_name: data.emergencyContactName ?? null,
        emergency_contact_phone: data.emergencyContactPhone ?? null,
        occupation: data.occupation ?? null,
        notes: data.notes ?? null,
        photo_url: data.photoUrl ?? null,
        custom_fields: JSON.stringify(data.customFields ?? []),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.tenantId);
    if (error) throw error;
    return { success: true };
  });

export const createPmLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      unitId: z.string().uuid(),
      tenantId: z.string().uuid(),
      monthlyRent: z.number().int().min(0),
      depositPaid: z.number().int().min(0).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      leaseDocumentUrl: z.string().url().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());

    const { data: unit } = await admin
      .from("pm_units")
      .select("*")
      .eq("id", data.unitId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!unit) throw new Error("Unit not found");

    const { staffRole } = await assertPmPropertyAccess(admin, userId, unit.property_id);
    assertStaffCan(staffRole, "leases:create");

    const { data: tenant } = await admin
      .from("pm_tenants")
      .select("id, property_id")
      .eq("id", data.tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!tenant || tenant.property_id !== unit.property_id) {
      throw new Error("Tenant must belong to the same property");
    }

    const { data: row, error } = await admin
      .from("pm_leases")
      .insert({
        unit_id: data.unitId,
        tenant_id: data.tenantId,
        monthly_rent: data.monthlyRent,
        deposit_paid: data.depositPaid ?? 0,
        start_date: data.startDate,
        end_date: data.endDate,
        status: "active",
        lease_document_url: data.leaseDocumentUrl ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    await admin
      .from("pm_units")
      .update({ status: "occupied", updated_at: new Date().toISOString() })
      .eq("id", data.unitId);

    // Seed current-period invoice so rent UI works before the monthly cron runs
    const periodMonth = new Date().toISOString().slice(0, 7);
    const due = new Date();
    due.setUTCDate(5);
    // If the 5th already passed this month, due next month's 5th so seed isn't instantly overdue
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (due < today) {
      due.setUTCMonth(due.getUTCMonth() + 1);
      due.setUTCDate(5);
    }
    const { error: invErr } = await admin.from("pm_rent_invoices").insert({
      lease_id: row.id,
      period_month: periodMonth,
      amount_due: data.monthlyRent,
      due_date: due.toISOString().slice(0, 10),
      status: "pending",
    });
    if (invErr && !/duplicate|unique/i.test(invErr.message ?? "")) {
      throw invErr;
    }

    return row;
  });

export const endPmLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      leaseId: z.string().uuid(),
      endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());

    const { data: lease } = await admin
      .from("pm_leases")
      .select("id, unit_id, status")
      .eq("id", data.leaseId)
      .maybeSingle();
    if (!lease) throw new Error("Lease not found");
    if (lease.status !== "active") throw new Error("Lease is not active");

    const { data: unit } = await admin
      .from("pm_units")
      .select("id, property_id")
      .eq("id", lease.unit_id)
      .maybeSingle();
    if (!unit) throw new Error("Unit not found");

    const { staffRole } = await assertPmPropertyAccess(admin, userId, unit.property_id);
    assertStaffCan(staffRole, "leases:create");

    const endedOn = data.endDate ?? new Date().toISOString().slice(0, 10);
    const { error } = await admin
      .from("pm_leases")
      .update({
        status: "ended",
        end_date: endedOn,
      })
      .eq("id", data.leaseId);
    if (error) throw error;

    await admin
      .from("pm_units")
      .update({ status: "vacant", updated_at: new Date().toISOString() })
      .eq("id", lease.unit_id);

    return { ok: true as const, leaseId: data.leaseId, unitId: lease.unit_id };
  });

export const listPmTenants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);
    assertStaffCan(staffRole, "tenants:view");

    const { data: tenants, error } = await admin
      .from("pm_tenants")
      .select("*")
      .eq("property_id", data.propertyId)
      .is("deleted_at", null)
      .order("full_name");
    if (error) throw error;

    const { data: leases } = await admin
      .from("pm_leases")
      .select("*, pm_units!inner(property_id, unit_label)")
      .eq("pm_units.property_id", data.propertyId)
      .eq("status", "active");

    return { tenants: tenants ?? [], leases: leases ?? [] };
  });

export const invitePmTenantPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ tenantId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());

    const { data: tenant } = await admin
      .from("pm_tenants")
      .select("*")
      .eq("id", data.tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!tenant) throw new Error("Tenant not found");

    const { property, staffRole } = await assertPmPropertyAccess(
      admin,
      userId,
      tenant.property_id,
    );
    assertStaffCan(staffRole, "tenants:update");

    const existingUserId = tenant.email ? await findAuthUserIdByEmail(tenant.email) : null;
    const inviteToken = crypto.randomUUID();
    await storePmTenantInvite(inviteToken, {
      tenantId: tenant.id,
      existingUserId,
      propertyId: tenant.property_id,
    });

    await admin
      .from("pm_tenants")
      .update({
        portal_status: "invited",
        portal_invited_at: new Date().toISOString(),
      })
      .eq("id", tenant.id);

    if (tenant.email) {
      const inviteUrl = `${getSiteUrl()}/tenant/invite/${inviteToken}`;
      const tpl = tenantPortalInviteEmail({
        tenantName: tenant.full_name,
        propertyName: property.name,
        inviteUrl,
        hasExistingAccount: Boolean(existingUserId),
      });
      await sendEmail({
        to: tenant.email,
        templateId: "tenant_portal_invite",
        ...tpl,
      });
    }

    return { success: true as const, inviteToken };
  });

export const respondPmTenantInvite = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string().uuid(),
      accept: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const invite = await readPmTenantInvite(data.token);
    if (!invite) {
      throw new Error("Invitation expired or invalid");
    }

    const admin = asPmDb(await adminClient());

    if (!data.accept) {
      await admin
        .from("pm_tenants")
        .update({ portal_status: "declined" })
        .eq("id", invite.tenantId);
      await deletePmTenantInvite(data.token);
      return { success: true as const, status: "declined" as const };
    }

    let linkedUserId: string | null = null;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const request = getRequest();
      const authHeader = request?.headers?.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length);
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const key =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (url && key) {
          const userClient = createClient(url, key, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: claims } = await userClient.auth.getClaims(token);
          if (claims?.claims?.sub) linkedUserId = claims.claims.sub as string;
        }
      }
    } catch {
      // no session
    }

    if (!linkedUserId) {
      return {
        requiresSignup: true as const,
        tenantId: invite.tenantId,
      };
    }

    // Prevent invite-link account hijack: invited existing user must match session
    if (invite.existingUserId && invite.existingUserId !== linkedUserId) {
      throw new Error("Sign in with the invited account to accept this invitation");
    }

    await admin
      .from("pm_tenants")
      .update({
        portal_status: "accepted",
        tenant_user_id: linkedUserId,
      })
      .eq("id", invite.tenantId);
    await deletePmTenantInvite(data.token);

    return { success: true as const, status: "accepted" as const };
  });

export const getPmTenantInvitePreview = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().uuid() }))
  .handler(async ({ data }) => {
    const invite = await readPmTenantInvite(data.token);
    if (!invite) return { valid: false as const };

    const admin = asPmDb(await adminClient());
    const { data: tenant } = await admin
      .from("pm_tenants")
      .select("id, full_name, email, portal_status, property_id")
      .eq("id", invite.tenantId)
      .maybeSingle();
    if (!tenant) return { valid: false as const };

    const { data: property } = await admin
      .from("pm_properties")
      .select("name, neighborhood")
      .eq("id", tenant.property_id)
      .maybeSingle();

    return {
      valid: true as const,
      tenantName: tenant.full_name as string,
      propertyName: (property?.name as string) ?? "Property",
      neighborhood: (property?.neighborhood as string) ?? "",
      portalStatus: tenant.portal_status as string,
      hasExistingAccount: Boolean(invite.existingUserId),
    };
  });

// ── Rent ──────────────────────────────────────────────────────────────────

export const listPmInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);
    assertStaffCan(staffRole, "invoices:view");

    const { data: units } = await admin
      .from("pm_units")
      .select("id, unit_label")
      .eq("property_id", data.propertyId)
      .is("deleted_at", null);
    const unitIds = (units ?? []).map((u: { id: string }) => u.id);
    if (unitIds.length === 0) return [];

    const { data: leases } = await admin
      .from("pm_leases")
      .select("id, unit_id, tenant_id, monthly_rent")
      .in("unit_id", unitIds);
    const leaseIds = (leases ?? []).map((l: { id: string }) => l.id);
    if (leaseIds.length === 0) return [];

    const { data: invoices, error } = await admin
      .from("pm_rent_invoices")
      .select("id, lease_id, period_month, due_date, status, amount_due, amount_paid, late_fee")
      .in("lease_id", leaseIds)
      .order("period_month", { ascending: false })
      .limit(240);
    if (error) throw error;

    const unitById = new Map(
      (units ?? []).map((u: { id: string; unit_label: string }) => [u.id, u.unit_label]),
    );
    const leaseById = new Map(
      (leases ?? []).map((l: { id: string; unit_id: string; tenant_id: string }) => [l.id, l]),
    );

    return (invoices ?? []).map((inv: Record<string, unknown>) => {
      const lease = leaseById.get(inv.lease_id as string);
      return {
        id: inv.id as string,
        lease_id: inv.lease_id as string,
        period_month: inv.period_month as string,
        due_date: inv.due_date as string,
        status: inv.status as string,
        amount_due: Number(inv.amount_due),
        amount_paid: Number(inv.amount_paid),
        late_fee: Number(inv.late_fee ?? 0),
        unit_label: lease ? (unitById.get(lease.unit_id) ?? null) : null,
        tenant_id: lease?.tenant_id ?? null,
      };
    });
  });

/** Rent ledger for CSV / Excel / printable PDF export. */
export const getPmFinancialReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyId: z.string().uuid(),
      periodMonth: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);
    assertStaffCan(staffRole, "invoices:view");

    const periodMonth = data.periodMonth ?? new Date().toISOString().slice(0, 7);

    const { data: property } = await admin
      .from("pm_properties")
      .select("name")
      .eq("id", data.propertyId)
      .maybeSingle();
    const propertyName = (property?.name as string | undefined) ?? "Property";

    const { data: units } = await admin
      .from("pm_units")
      .select("id, unit_label")
      .eq("property_id", data.propertyId)
      .is("deleted_at", null);
    const unitIds = (units ?? []).map((u: { id: string }) => u.id);
    if (unitIds.length === 0) {
      const { buildFinancialReportSummary } = await import("@/lib/pm/financial-report");
      return {
        summary: buildFinancialReportSummary(propertyName, periodMonth, []),
        rows: [],
      };
    }

    const { data: leases } = await admin
      .from("pm_leases")
      .select("id, unit_id, tenant_id")
      .in("unit_id", unitIds);
    const leaseIds = (leases ?? []).map((l: { id: string }) => l.id);
    if (leaseIds.length === 0) {
      const { buildFinancialReportSummary } = await import("@/lib/pm/financial-report");
      return {
        summary: buildFinancialReportSummary(propertyName, periodMonth, []),
        rows: [],
      };
    }

    const { data: invoices, error } = await admin
      .from("pm_rent_invoices")
      .select("*")
      .in("lease_id", leaseIds)
      .eq("period_month", periodMonth)
      .order("due_date", { ascending: true });
    if (error) throw error;

    const unitById = new Map(
      (units ?? []).map((u: { id: string; unit_label: string }) => [u.id, u.unit_label]),
    );
    const leaseById = new Map(
      (leases ?? []).map((l: { id: string; unit_id: string; tenant_id: string }) => [l.id, l]),
    );
    const tenantIds = [
      ...new Set((leases ?? []).map((l: { tenant_id: string }) => l.tenant_id)),
    ];
    const tenantName = new Map<string, string>();
    if (tenantIds.length) {
      const { data: tenants } = await admin
        .from("pm_tenants")
        .select("id, full_name")
        .in("id", tenantIds);
      for (const t of tenants ?? []) {
        tenantName.set(t.id as string, (t.full_name as string) ?? "Tenant");
      }
    }

    const { buildFinancialReportSummary } = await import("@/lib/pm/financial-report");

    const rows = (invoices ?? []).map((inv: Record<string, unknown>) => {
      const lease = leaseById.get(inv.lease_id as string);
      return {
        propertyName,
        unitLabel: lease ? (unitById.get(lease.unit_id) ?? "") : "",
        tenantName: lease ? (tenantName.get(lease.tenant_id) ?? "Tenant") : "Tenant",
        periodMonth: inv.period_month as string,
        dueDate: inv.due_date as string,
        amountDue: Number(inv.amount_due),
        amountPaid: Number(inv.amount_paid),
        lateFee: Number(inv.late_fee ?? 0),
        status: inv.status as string,
      };
    });

    const summary = buildFinancialReportSummary(propertyName, periodMonth, rows);
    return { summary, rows };
  });

export const recordPmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      invoiceId: z.string().uuid(),
      amount: z.number().int().positive(),
      method: z.enum(["manual", "cash", "bank"]).default("manual"),
      note: z.string().max(500).optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());

    const { data: invoice } = await admin
      .from("pm_rent_invoices")
      .select("*")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (!invoice) throw new Error("Invoice not found");

    const { data: lease } = await admin
      .from("pm_leases")
      .select("unit_id")
      .eq("id", invoice.lease_id)
      .maybeSingle();
    if (!lease) throw new Error("Lease not found");

    const { data: unit } = await admin
      .from("pm_units")
      .select("property_id")
      .eq("id", lease.unit_id)
      .maybeSingle();
    if (!unit) throw new Error("Unit not found");

    const { staffRole } = await assertPmPropertyAccess(admin, userId, unit.property_id);
    assertStaffCan(staffRole, "payments:create");

    const { data: property } = await admin
      .from("pm_properties")
      .select("id, owner_user_id")
      .eq("id", unit.property_id)
      .maybeSingle();
    if (!property) throw new Error("Property not found");

    const { data: payRow, error: payErr } = await admin
      .from("pm_rent_payments")
      .insert({
        invoice_id: data.invoiceId,
        amount: data.amount,
        method: data.method,
        recorded_by_user_id: userId,
        note: data.note ?? null,
      })
      .select("id")
      .single();
    if (payErr) throw payErr;

    try {
      const { recordPlatformFee } = await import("@/lib/pm/platform-fee");
      await recordPlatformFee(admin, {
        rentPaymentId: payRow.id,
        ownerUserId: property.owner_user_id,
        propertyId: property.id,
        grossAmount: data.amount,
      });
    } catch (e) {
      console.warn("[pm] platform fee record failed:", e);
    }

    const reconciled = await recomputeInvoiceStatus(admin, data.invoiceId);
    return { success: true as const, ...reconciled };
  });

// ── Dashboard ─────────────────────────────────────────────────────────────

export const getPmPropertyDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    await assertPmPropertyAccess(admin, userId, data.propertyId);

    const periodMonth = new Date().toISOString().slice(0, 7);
    const in30 = new Date();
    in30.setUTCDate(in30.getUTCDate() + 30);
    const in30Iso = in30.toISOString().slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);

    const { data: units } = await admin
      .from("pm_units")
      .select("id, status")
      .eq("property_id", data.propertyId)
      .is("deleted_at", null);

    const totalUnits = units?.length ?? 0;
    const occupiedUnits = (units ?? []).filter(
      (u: { status: string }) => u.status === "occupied",
    ).length;
    const vacantUnits = (units ?? []).filter(
      (u: { status: string }) => u.status === "vacant",
    ).length;
    const unitIds = (units ?? []).map((u: { id: string }) => u.id);

    let expectedIncome = 0;
    let collectedThisMonth = 0;
    let outstandingRent = 0;
    let openMaintenanceRequests = 0;
    let avgMaintenanceDays: number | null = null;
    let upcomingLeaseExpirations: Array<{
      end_date: string;
      full_name: string;
      unit_label: string;
    }> = [];

    if (unitIds.length > 0) {
      const { data: leases } = await admin
        .from("pm_leases")
        .select("id, unit_id, tenant_id, end_date, status")
        .in("unit_id", unitIds)
        .eq("status", "active");

      const leaseIds = (leases ?? []).map((l: { id: string }) => l.id);
      const {
        sumRentForPeriod,
        avgClosedMaintenanceDays,
        leasesEndingSoon,
      } = await import("@/lib/pm/dashboard-metrics");

      const rent = await sumRentForPeriod(admin, leaseIds, periodMonth);
      expectedIncome = rent.expectedIncome;
      collectedThisMonth = rent.collectedThisMonth;
      outstandingRent = rent.outstandingRent;

      const { count } = await admin
        .from("pm_maintenance_requests")
        .select("id", { count: "exact", head: true })
        .in("unit_id", unitIds)
        .not("status", "in", '("completed","confirmed")');
      openMaintenanceRequests = count ?? 0;
      avgMaintenanceDays = await avgClosedMaintenanceDays(admin, unitIds);
      upcomingLeaseExpirations = await leasesEndingSoon(
        admin,
        (leases ?? []) as Array<{ end_date: string; tenant_id: string; unit_id: string }>,
        todayIso,
        in30Iso,
      );
    }

    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    const { computePropertyHealthScore } = await import("@/lib/pm/property-health");
    const health = computePropertyHealthScore({
      occupancyRate,
      expectedIncomeKes: expectedIncome,
      collectedThisMonthKes: collectedThisMonth,
      totalUnits,
      vacantUnits,
      openMaintenanceRequests,
      avgMaintenanceDays,
    });

    return {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate,
      expectedIncome,
      collectedThisMonth,
      outstandingRent,
      openMaintenanceRequests,
      avgMaintenanceDays,
      health,
      upcomingLeaseExpirations,
    };
  });

// ── Staff ─────────────────────────────────────────────────────────────────

export const listPmStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);
    assertStaffCan(staffRole, "staff:view");

    const { data: rows, error } = await admin
      .from("pm_property_staff")
      .select("*")
      .eq("property_id", data.propertyId)
      .order("created_at");
    if (error) throw error;
    return rows ?? [];
  });

export const upsertPmStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyId: z.string().uuid(),
      userId: z.string().uuid(),
      role: staffRoleSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requirePortalRole(supabase, userId);
    const admin = asPmDb(await adminClient());
    const { staffRole } = await assertPmPropertyAccess(admin, userId, data.propertyId);
    if (staffRole !== "owner") {
      throw new ForbiddenError("Only the property owner can manage staff");
    }

    const { data: row, error } = await admin
      .from("pm_property_staff")
      .upsert(
        {
          property_id: data.propertyId,
          user_id: data.userId,
          role: data.role as PmStaffRole,
        },
        { onConflict: "property_id,user_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });
