import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Property } from "@/lib/properties";
import { ForbiddenError, requireRole } from "@/lib/api/_authz";
import {
  createPublicClient,
  PROPERTY_DETAIL_COLUMNS,
  PUBLIC_PROPERTY_COLUMNS,
} from "@/lib/api/public-client";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { filterMockListings, getMockProperty, mockListingsEnabled } from "@/data/mockListings";
import {
  adminClient,
  authContext,
  getUserOrganizationId,
  listPropertiesSchema,
  mapPropertyRow,
  mapPropertyRows,
  propertyIdSchema,
  propertyPayloadSchema,
} from "@/lib/api/nyumba/nyumba-shared";

export const listProperties = createServerFn({ method: "POST" })
  .inputValidator(listPropertiesSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    checkRateLimit(request?.headers?.get("cf-connecting-ip") ?? "list-properties");

    const supabase = createPublicClient();
    const limit = data?.limit ?? 50;
    const offset = data?.offset ?? 0;

    let query = supabase
      .from("properties")
      .select(PUBLIC_PROPERTY_COLUMNS, { count: "exact" })
      .eq("is_active", true);

    if (data?.neighborhood && data.neighborhood !== "All") {
      query = query.eq("neighborhood", data.neighborhood);
    }
    if (data?.propertyType) query = query.eq("property_type", data.propertyType);
    if (data?.minRent) query = query.gte("rent_kes", data.minRent);
    if (data?.maxRent) query = query.lte("rent_kes", data.maxRent);
    if (data?.verifiedOnly) query = query.eq("is_verified", true);
    if (data?.minBedrooms) query = query.gte("bedrooms", data.minBedrooms);
    if (data?.minAuthenticityScore)
      query = query.gte("authenticity_score", data.minAuthenticityScore);
    if (data?.bounds) {
      query = query
        .gte("latitude", data.bounds.minLat)
        .lte("latitude", data.bounds.maxLat)
        .gte("longitude", data.bounds.minLng)
        .lte("longitude", data.bounds.maxLng);
    }
    if (data?.query) {
      const term = data.query
        .replaceAll(",", " ")
        .replace(/[()[\].,:*!%\\]/g, "")
        .trim()
        .slice(0, 100);
      if (term) {
        const typeTerm = term.replaceAll(" ", "_");
        query = query.or(
          `title.ilike.*${term}*,neighborhood.ilike.*${term}*,property_type.eq.${typeTerm}`,
        );
      }
    }

    switch (data?.sortBy ?? "newest") {
      case "price_asc":
        query = query.order("rent_kes", { ascending: true });
        break;
      case "price_desc":
        query = query.order("rent_kes", { ascending: false });
        break;
      case "score":
        query = query.order("authenticity_score", { ascending: false });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: rows, error, count } = await query;
    if (error) throw error;

    let items = mapPropertyRows(rows ?? []);
    let total = count ?? items.length;

    if (mockListingsEnabled()) {
      const mockResult = filterMockListings({
        neighborhood: data?.neighborhood,
        propertyType: data?.propertyType,
        minRent: data?.minRent,
        maxRent: data?.maxRent,
        verifiedOnly: data?.verifiedOnly,
        minBedrooms: data?.minBedrooms,
        minAuthenticityScore: data?.minAuthenticityScore,
        bounds: data?.bounds,
        query: data?.query,
        sortBy: data?.sortBy,
        limit,
        offset,
      });
      const liveIds = new Set(items.map((item) => item.id));
      const extras = mockResult.items.filter((item) => !liveIds.has(item.id));
      items = [...items, ...extras];
      total = items.length;
    }

    return {
      items,
      total,
      limit,
      offset,
    };
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
    const organizationId =
      isAgency || isManager ? await getUserOrganizationId(supabase, userId) : null;
    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        ...data,
        owner_id: userId,
        organization_id: organizationId,
        property_type: data.property_type,
      })
      .select("*")
      .single();

    if (error) throw error;

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
  .handler(async ({ data }) => {
    const admin = await adminClient();
    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("owner_id, is_active")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (propertyError) throw propertyError;
    if (!property?.owner_id || !property.is_active) {
      return { phone: null, fullName: null };
    }
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("phone, full_name")
      .eq("id", property.owner_id)
      .maybeSingle();
    if (profileError) throw profileError;
    return {
      phone: profile?.phone?.trim() || null,
      fullName: profile?.full_name ?? null,
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
    let allowed = property.owner_id === userId;
    if (!allowed && (roles.has("manager") || roles.has("agency")) && property.organization_id) {
      const orgId = await getUserOrganizationId(supabase, userId);
      allowed = orgId === property.organization_id;
    }
    if (!allowed) throw new ForbiddenError("You cannot update this property");

    const { data: updated, error } = await admin
      .from("properties")
      .update({ is_vacant: data.isVacant, updated_at: new Date().toISOString() })
      .eq("id", data.propertyId)
      .select("*")
      .single();
    if (error) throw error;
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
