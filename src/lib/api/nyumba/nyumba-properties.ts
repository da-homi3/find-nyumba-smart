import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Property } from "@/lib/properties";
import { ForbiddenError, requireRole } from "@/lib/api/_authz";
import { assertPropertyAccess } from "@/lib/api/agency-scope";
import { createPublicClient, PROPERTY_DETAIL_COLUMNS } from "@/lib/api/public-client";
import { queryListings } from "@/lib/api/listings-core";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getMockProperty, mockListingsEnabled } from "@/data/mockListings";
import {
  adminClient,
  assertCanManageProperty,
  authContext,
  getUserOrganizationId,
  listPropertiesSchema,
  mapPropertyRow,
  mapPropertyRows,
  propertyIdSchema,
  propertyPayloadSchema,
} from "@/lib/api/nyumba/nyumba-shared";
import {
  duplicateListingMessage,
  throwIfListingDuplicateDbError,
} from "@/lib/api/nyumba/listing-duplicate-errors";
import { getTenantPlusStatus } from "@/lib/revenue/subscription-store";

export const listProperties = createServerFn({ method: "POST" })
  .inputValidator(listPropertiesSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    checkRateLimit(request?.headers?.get("cf-connecting-ip") ?? "list-properties");
    return queryListings(data);
  });

export const getProperty = createServerFn({ method: "POST" })
  .inputValidator(propertyIdSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    checkRateLimit(request?.headers?.get("cf-connecting-ip") ?? "get-property");

    const supabase = createPublicClient();
    const { data: property, error } = await supabase
      .from("properties")
      .select(PROPERTY_DETAIL_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw error;
    if (!property?.is_active) {
      if (mockListingsEnabled()) return getMockProperty(data.id);
      return null;
    }

    // View recording requires service role (SECURITY DEFINER RPC) — non-fatal
    try {
      const admin = await adminClient();
      const { error: viewError } = await admin.rpc("record_property_view", {
        _property_id: property.id,
        _session_id: data.sessionId ?? undefined,
        _source: data.source ?? "property-detail",
      });
      if (viewError) console.warn("record_property_view:", viewError.message);
    } catch (viewErr) {
      console.warn("record_property_view failed:", viewErr);
    }

    return mapPropertyRow(property);
  });

export const listSavedProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "tenant");
    const { data, error } = await supabase
      .from("saved_properties")
      .select("properties(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? [])
      .map((row) => (row.properties ? mapPropertyRow(row.properties) : null))
      .filter((property): property is Property => property !== null);
  });

export const toggleSavedProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid(), saved: z.boolean().optional() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "tenant");
    const { data: existing, error: existingError } = await supabase
      .from("saved_properties")
      .select("id")
      .eq("user_id", userId)
      .eq("property_id", data.propertyId)
      .maybeSingle();

    if (existingError) throw existingError;
    const shouldSave = data.saved ?? !existing;

    if (shouldSave && !existing) {
      const { error } = await supabase
        .from("saved_properties")
        .insert({ user_id: userId, property_id: data.propertyId });
      if (error) throw error;
    }

    if (!shouldSave && existing) {
      const { error } = await supabase
        .from("saved_properties")
        .delete()
        .eq("user_id", userId)
        .eq("property_id", data.propertyId);
      if (error) throw error;
    }

    return { saved: shouldSave };
  });

export const createProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(propertyPayloadSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = new Set((roleRows ?? []).map((r) => r.role));
    const isLandlord = roles.has("landlord");
    const isAgency = roles.has("agency");
    const isManager = roles.has("manager");
    if (!isLandlord && !isAgency && !isManager) {
      throw new ForbiddenError("Forbidden: requires role landlord, manager, or agency");
    }

    const { getListingCap, countActiveListings } = await import("@/lib/promo/listing-cap");
    const [cap, activeCount] = await Promise.all([
      getListingCap(supabase, userId),
      countActiveListings(supabase, userId),
    ]);
    if (activeCount >= cap) {
      throw new ForbiddenError(
        `You've reached your listing limit of ${cap}. Upgrade your plan for more.`,
      );
    }

    const organizationId =
      isAgency || isManager ? await getUserOrganizationId(supabase, userId) : null;

    const admin = await adminClient();
    const { computeListingFingerprint, findDuplicateActiveListing } =
      await import("@/lib/api/nyumba/listing-fingerprint");
    const fingerprintInput = {
      title: data.title,
      neighborhood: data.neighborhood,
      property_type: data.property_type,
      bedrooms: data.bedrooms,
      address: data.address ?? null,
    };
    const duplicate = await findDuplicateActiveListing(admin, fingerprintInput);
    if (duplicate) {
      const ownedBySameAccount =
        duplicate.ownerId === userId ||
        (organizationId != null && duplicate.organizationId === organizationId);
      throw new ForbiddenError(duplicateListingMessage(ownedBySameAccount));
    }
    const duplicateHash = await computeListingFingerprint(fingerprintInput);

    const { neighborhoodCentroid } = await import("@/lib/geo/property-map-coords");
    let latitude = data.latitude ?? null;
    let longitude = data.longitude ?? null;
    if ((latitude == null || longitude == null) && data.neighborhood) {
      const centroid = neighborhoodCentroid(data.neighborhood);
      if (centroid) {
        latitude = centroid.lat;
        longitude = centroid.lng;
      }
    }

    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        ...data,
        latitude,
        longitude,
        owner_id: userId,
        organization_id: organizationId,
        property_type: data.property_type,
        duplicate_hash: duplicateHash,
      })
      .select("*")
      .single();

    if (error) {
      throwIfListingDuplicateDbError(error);
      throw error;
    }

    // Automatic area analysis for landlord / manager / agency uploads
    try {
      const { applyPropertyAreaAnalysis } = await import("@/lib/api/apply-area-analysis");
      await applyPropertyAreaAnalysis(admin, property.id);
      const { data: refreshed } = await admin
        .from("properties")
        .select("*")
        .eq("id", property.id)
        .single();
      if (refreshed) {
        const mapped = mapPropertyRow(refreshed);
        void import("@/lib/api/search-alert-notify").then(({ notifyMatchingSearchAlerts }) =>
          notifyMatchingSearchAlerts(mapped),
        );
        return mapped;
      }
    } catch (err) {
      console.error("[createProperty] area analysis failed:", err);
    }

    const mapped = mapPropertyRow(property);
    void import("@/lib/api/search-alert-notify").then(({ notifyMatchingSearchAlerts }) =>
      notifyMatchingSearchAlerts(mapped),
    );

    return mapped;
  });

export const listLandlordProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "landlord");
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return mapPropertyRows(data ?? []);
  });

export const listAgencyProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "agency");
    const orgId = await getUserOrganizationId(supabase, userId);
    let query = supabase.from("properties").select("*").order("created_at", { ascending: false });
    if (orgId) {
      query = query.eq("organization_id", orgId);
    } else {
      query = query.eq("owner_id", userId);
    }
    const { data, error } = await query.limit(500);
    if (error) throw error;
    return mapPropertyRows(data ?? []);
  });

export const listAgencyTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "agency");
    const orgId = await getUserOrganizationId(supabase, userId);
    if (!orgId) return [];

    const { data: members, error } = await supabase
      .from("organization_members")
      .select("user_id, role, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!members?.length) return [];

    const userIds = members.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return members.map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id) ?? null,
    }));
  });

export const listManagerProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "manager");
    const orgId = await getUserOrganizationId(supabase, userId);
    if (orgId) {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return mapPropertyRows(data ?? []);
    }
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return mapPropertyRows(data ?? []);
  });

export const getPropertyOwnerContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { userId } = authContext(context);
    const admin = await adminClient();
    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("owner_id, is_active, contact_phone")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (propertyError) throw propertyError;
    if (!property?.owner_id || !property.is_active) {
      return { phone: null, fullName: null, unlocked: false };
    }

    if (property.owner_id === userId) {
      const phone =
        property.contact_phone?.trim() ||
        (
          await admin
            .from("profiles")
            .select("phone, full_name")
            .eq("id", property.owner_id)
            .maybeSingle()
        ).data?.phone?.trim() ||
        null;
      const fullName =
        (await admin.from("profiles").select("full_name").eq("id", property.owner_id).maybeSingle())
          .data?.full_name ?? null;
      return { phone, fullName, unlocked: true };
    }

    const plus = await getTenantPlusStatus(admin, userId);
    const { data: unlock } = await admin
      .from("contact_unlocks")
      .select("id")
      .eq("user_id", userId)
      .eq("listing_id", data.propertyId)
      .maybeSingle();

    if (plus.tenantPlan !== "plus" && !unlock) {
      return { phone: null, fullName: null, unlocked: false };
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("phone, full_name")
      .eq("id", property.owner_id)
      .maybeSingle();
    if (profileError) throw profileError;

    const phone = property.contact_phone?.trim() || profile?.phone?.trim() || null;
    return {
      phone,
      fullName: profile?.full_name ?? null,
      unlocked: true,
    };
  });

export const updatePropertyVacancy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyId: z.string().uuid(),
      isVacant: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency"]);

    const admin = await adminClient();
    const { data: property, error: fetchError } = await admin
      .from("properties")
      .select("id, owner_id, organization_id")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!property) throw new Error("Property not found");

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = new Set((roleRows ?? []).map((r) => r.role));
    await assertPropertyAccess(supabase, userId, property, roles);

    const { data: updated, error } = await admin
      .from("properties")
      .update({ is_vacant: data.isVacant, updated_at: new Date().toISOString() })
      .eq("id", data.propertyId)
      .select("*")
      .single();
    if (error) throw error;
    return mapPropertyRow(updated);
  });

export const getManageableProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(propertyIdSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await assertCanManageProperty(supabase, userId, data.id);
    const admin = await adminClient();
    const { data: row, error } = await admin
      .from("properties")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    return mapPropertyRow(row);
  });

export const updateProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    propertyPayloadSchema.extend({
      propertyId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    const { propertyId, ...payload } = data;
    await assertCanManageProperty(supabase, userId, propertyId);
    const admin = await adminClient();

    const { computeListingFingerprint, findDuplicateActiveListing } =
      await import("@/lib/api/nyumba/listing-fingerprint");
    const fingerprintInput = {
      title: payload.title,
      neighborhood: payload.neighborhood,
      property_type: payload.property_type,
      bedrooms: payload.bedrooms,
      address: payload.address ?? null,
    };
    const duplicate = await findDuplicateActiveListing(admin, fingerprintInput, propertyId);
    if (duplicate) {
      throw new ForbiddenError(
        "Another active listing already matches this property. To keep listings credible and unique, each property can only be listed once.",
      );
    }
    const duplicateHash = await computeListingFingerprint(fingerprintInput);

    const { neighborhoodCentroid } = await import("@/lib/geo/property-map-coords");
    let latitude = payload.latitude ?? null;
    let longitude = payload.longitude ?? null;
    if ((latitude == null || longitude == null) && payload.neighborhood) {
      const centroid = neighborhoodCentroid(payload.neighborhood);
      if (centroid) {
        latitude = centroid.lat;
        longitude = centroid.lng;
      }
    }

    const { data: updated, error } = await admin
      .from("properties")
      .update({
        ...payload,
        latitude,
        longitude,
        property_type: payload.property_type,
        duplicate_hash: duplicateHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", propertyId)
      .select("*")
      .single();
    if (error) {
      throwIfListingDuplicateDbError(error);
      throw error;
    }

    try {
      const { applyPropertyAreaAnalysis } = await import("@/lib/api/apply-area-analysis");
      await applyPropertyAreaAnalysis(admin, propertyId);
      const { data: refreshed } = await admin
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .single();
      if (refreshed) return mapPropertyRow(refreshed);
    } catch (err) {
      console.error("[updateProperty] area analysis failed:", err);
    }

    return mapPropertyRow(updated);
  });

export const getLandlordDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "landlord");
    const [{ data: properties, error: propertiesError }, { data: leads, error: leadsError }] =
      await Promise.all([
        supabase.from("properties").select("*").eq("owner_id", userId),
        supabase.from("inquiries").select("*").eq("landlord_id", userId),
      ]);

    if (propertiesError) throw propertiesError;
    if (leadsError) throw leadsError;

    const propertyRows = mapPropertyRows(properties ?? []);
    const leadRows = leads ?? [];
    const activeProperties = propertyRows.filter((p) => p.is_active);
    const totalViews = propertyRows.reduce((sum, p) => sum + p.views, 0);
    const potentialRevenue = activeProperties.reduce((sum, p) => sum + p.rent_kes, 0);

    return {
      properties: propertyRows,
      leads: leadRows,
      stats: {
        totalProperties: propertyRows.length,
        activeProperties: activeProperties.length,
        totalViews,
        totalLeads: leadRows.length,
        newLeads: leadRows.filter((lead) => lead.status === "new").length,
        potentialRevenue,
      },
    };
  });
