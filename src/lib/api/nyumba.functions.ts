import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { Property, PropertyType } from "@/lib/properties";
import { ForbiddenError, requireRole } from "@/lib/api/_authz";
import { createPublicClient, PUBLIC_PROPERTY_COLUMNS } from "@/lib/api/public-client";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequest } from "@tanstack/react-start/server";

type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

type InquiryRecord = Database["public"]["Tables"]["inquiries"]["Row"];
type ProfileRecord = Database["public"]["Tables"]["profiles"]["Row"];
type InquiryMessageRecord = Database["public"]["Tables"]["inquiry_messages"]["Row"];

type InquiryWithDetails = InquiryRecord & {
  properties?: Pick<Property, "id" | "title" | "neighborhood" | "rent_kes" | "images"> | null;
  profiles?: Pick<ProfileRecord, "id" | "full_name" | "phone" | "avatar_url"> | null;
  inquiry_messages?: InquiryMessageRecord[];
};

const propertyTypes = [
  "bedsitter",
  "single_room",
  "one_bedroom",
  "two_bedroom",
  "three_bedroom",
  "studio",
  "hostel",
  "maisonette",
  "bungalow",
  "townhouse",
] as const;

const propertyTypeSchema = z.enum(propertyTypes);

const listPropertiesSchema = z
  .object({
    query: z.string().trim().optional(),
    neighborhood: z.string().trim().optional(),
    propertyType: propertyTypeSchema.optional(),
    minRent: z.number().int().positive().optional(),
    maxRent: z.number().int().positive().optional(),
    verifiedOnly: z.boolean().optional(),
    minBedrooms: z.number().int().min(0).optional(),
    parking: z.boolean().optional(),
    petFriendly: z.boolean().optional(),
    minAuthenticityScore: z.number().int().min(0).max(100).optional(),
    // Bounding box for map/polygon search
    bounds: z
      .object({
        minLat: z.number(),
        maxLat: z.number(),
        minLng: z.number(),
        maxLng: z.number(),
      })
      .optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
    sortBy: z.enum(["newest", "price_asc", "price_desc", "score"]).default("newest"),
  })
  .optional();

const propertyIdSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().trim().max(128).optional(),
  source: z.string().trim().max(64).optional(),
});

const propertyPayloadSchema = z.object({
  title: z.string().trim().min(3),
  property_type: propertyTypeSchema,
  neighborhood: z.string().trim().min(2),
  address: z.string().trim().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  rent_kes: z.number().int().positive(),
  deposit_kes: z.number().int().nonnegative().nullable().optional(),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().int().min(1),
  area_sqm: z.number().int().positive().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  amenities: z.array(z.string().trim().min(1)).default([]),
  images: z.array(z.string().url()).default([]),
  video_url: z.string().url().nullable().optional(),
  tour_url: z.string().url().nullable().optional(),
  available_from: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});

const createInquirySchema = z.object({
  propertyId: z.string().uuid(),
  message: z.string().trim().min(3).max(1000),
});

const updateInquiryStatusSchema = z.object({
  inquiryId: z.string().uuid(),
  status: z.enum(["new", "contacted", "viewing", "closed", "archived"]),
});

const sendInquiryMessageSchema = z.object({
  inquiryId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
});

const inquiryIdSchema = z.object({ inquiryId: z.string().uuid() });

function authContext(context: unknown): AuthContext {
  const ctx = context as Partial<AuthContext>;
  if (!ctx.supabase || !ctx.userId) throw new Error("Unauthorized");
  return { supabase: ctx.supabase, userId: ctx.userId };
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertInquiryParticipant(
  supabase: AuthContext["supabase"],
  userId: string,
  inquiryId: string,
) {
  const { data: inquiry, error } = await supabase
    .from("inquiries")
    .select("*, properties(id, title, organization_id, owner_id)")
    .eq("id", inquiryId)
    .maybeSingle();
  if (error) throw error;
  if (!inquiry) throw new Error("Conversation not found");

  if (inquiry.tenant_id === userId || inquiry.landlord_id === userId) {
    return inquiry;
  }

  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = new Set((roleRows ?? []).map((r) => r.role));
  if (roles.has("manager") || roles.has("agency")) {
    const orgId = await getUserOrganizationId(supabase, userId);
    const property = inquiry.properties as { organization_id?: string | null } | null;
    if (orgId && property?.organization_id === orgId) {
      return inquiry;
    }
  }

  throw new ForbiddenError("Forbidden: not a participant in this conversation");
}

async function notifyInquiryParticipant(
  inquiry: InquiryRecord & { properties?: { title?: string } | null },
  senderId: string,
  body: string,
) {
  const recipientId = inquiry.tenant_id === senderId ? inquiry.landlord_id : inquiry.tenant_id;
  if (!recipientId) return;
  const admin = await adminClient();
  const [{ data: senderProfile }, { data: recipientProfile }, recipientAuth] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", senderId).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", recipientId).maybeSingle(),
    admin.auth.admin.getUserById(recipientId),
  ]);

  const { notifyNewMessage } = await import("@/lib/api/notify");
  const baseUrl = process.env.PUBLIC_APP_URL ?? "https://nyumba-search.kevinbuluma1.workers.dev";
  const threadPath =
    inquiry.tenant_id === recipientId
      ? `/tenant/messages/${inquiry.id}`
      : `/landlord/leads?thread=${inquiry.id}`;

  await notifyNewMessage({
    recipientEmail: recipientAuth.data.user?.email,
    recipientName: recipientProfile?.full_name ?? "there",
    senderName: senderProfile?.full_name ?? "Someone",
    propertyTitle: inquiry.properties?.title ?? "your listing",
    preview: body,
    threadUrl: `${baseUrl}${threadPath}`,
  });
}

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
    return {
      items: (rows ?? []) as Property[],
      total: count ?? 0,
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
      .select(PUBLIC_PROPERTY_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw error;
    if (!property || !property.is_active) return null;

    // View recording requires service role (SECURITY DEFINER RPC)
    const admin = await adminClient();
    await admin
      .rpc("record_property_view", {
        _property_id: property.id,
        _session_id: data.sessionId ?? undefined,
        _source: data.source ?? "property-detail",
      })
      .throwOnError();

    return property as Property;
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
      .map((row) => row.properties as unknown as Property | null)
      .filter((property): property is Property => Boolean(property));
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

async function getUserOrganizationId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.organization_id ?? null;
}

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
    if (!isLandlord && !isAgency) {
      throw new ForbiddenError("Forbidden: requires role landlord or agency");
    }
    const organizationId = isAgency ? await getUserOrganizationId(supabase, userId) : null;
    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        ...data,
        owner_id: userId,
        organization_id: organizationId,
        property_type: data.property_type as PropertyType,
      })
      .select("*")
      .single();

    if (error) throw error;

    void import("@/lib/api/search-alert-notify").then(({ notifyMatchingSearchAlerts }) =>
      notifyMatchingSearchAlerts(property as Property),
    );

    return property as Property;
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
    return (data ?? []) as Property[];
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
    return (data ?? []) as Property[];
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
      return (data ?? []) as Property[];
    }
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as Property[];
  });

export const createInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createInquirySchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "tenant");
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, owner_id, title")
      .eq("id", data.propertyId)
      .eq("is_active", true)
      .maybeSingle();

    if (propertyError) throw propertyError;
    if (!property?.owner_id) throw new Error("Landlord contact is unavailable for this listing");

    const { data: existingInquiry, error: existingError } = await supabase
      .from("inquiries")
      .select("*")
      .eq("tenant_id", userId)
      .eq("property_id", property.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    let inquiry = existingInquiry as InquiryRecord | null;

    if (!inquiry) {
      const { data: insertedInquiry, error: insertError } = await supabase
        .from("inquiries")
        .insert({
          tenant_id: userId,
          landlord_id: property.owner_id,
          property_id: property.id,
          message: data.message,
        })
        .select("*")
        .single();

      if (insertError) throw insertError;
      inquiry = insertedInquiry as InquiryRecord;
    }

    if (!inquiry) {
      throw new Error("Could not start this conversation");
    }

    const { error: messageError } = await supabase.from("inquiry_messages").insert({
      inquiry_id: inquiry.id,
      sender_id: userId,
      body: data.message,
    });
    if (messageError) throw messageError;

    await supabase
      .from("inquiries")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", inquiry.id);

    void notifyInquiryParticipant(
      { ...inquiry, properties: { title: property.title } },
      userId,
      data.message,
    );

    return inquiry as InquiryRecord;
  });

export const listTenantInquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "tenant");
    const { data, error } = await supabase
      .from("inquiries")
      .select(
        "*, properties(id,title,neighborhood,rent_kes,images), profiles:landlord_id(id,full_name,phone,avatar_url), inquiry_messages(*)",
      )
      .eq("tenant_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as InquiryWithDetails[];
  });

export const listLandlordLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency"]);

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const ownedRoles = new Set((roleRows ?? []).map((r) => r.role));
    const portfolioWide =
      (ownedRoles.has("manager") || ownedRoles.has("agency")) && !ownedRoles.has("landlord");

    let query = supabase
      .from("inquiries")
      .select(
        "*, properties(id,title,neighborhood,rent_kes,images,organization_id), profiles:tenant_id(id,full_name,phone,avatar_url), inquiry_messages(*)",
      )
      .order("updated_at", { ascending: false });

    if (portfolioWide) {
      const orgId = await getUserOrganizationId(supabase, userId);
      if (orgId) {
        const { data: orgProps, error: orgPropsError } = await supabase
          .from("properties")
          .select("id")
          .eq("organization_id", orgId);
        if (orgPropsError) throw orgPropsError;
        const propertyIds = (orgProps ?? []).map((p) => p.id);
        if (propertyIds.length === 0) return [];
        query = query.in("property_id", propertyIds);
      } else {
        query = query.eq("landlord_id", userId);
      }
    } else {
      query = query.eq("landlord_id", userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data ?? []) as unknown as InquiryWithDetails[];
  });

export const updateInquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(updateInquiryStatusSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency"]);
    await assertInquiryParticipant(supabase, userId, data.inquiryId);

    const { data: inquiry, error } = await supabase
      .from("inquiries")
      .update({ status: data.status })
      .eq("id", data.inquiryId)
      .select("*")
      .single();

    if (error) throw error;
    return inquiry as InquiryRecord;
  });

export const listInquiryMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inquiryIdSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await assertInquiryParticipant(supabase, userId, data.inquiryId);
    const { data: messages, error } = await supabase
      .from("inquiry_messages")
      .select("*")
      .eq("inquiry_id", data.inquiryId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return messages ?? [];
  });

export const markMessagesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inquiryIdSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await assertInquiryParticipant(supabase, userId, data.inquiryId);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("inquiry_messages")
      .update({ read_at: now })
      .eq("inquiry_id", data.inquiryId)
      .neq("sender_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return { readAt: now };
  });

export const getInquiryThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inquiryIdSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    const inquiry = await assertInquiryParticipant(supabase, userId, data.inquiryId);
    const counterpartyId = inquiry.tenant_id === userId ? inquiry.landlord_id : inquiry.tenant_id;
    if (!counterpartyId) throw new Error("Conversation participant missing");
    const { data: counterparty } = await supabase
      .from("profiles")
      .select("id, full_name, phone, avatar_url")
      .eq("id", counterpartyId)
      .maybeSingle();
    return { inquiry, counterparty };
  });

export const sendInquiryMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sendInquiryMessageSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    const inquiry = await assertInquiryParticipant(supabase, userId, data.inquiryId);

    const { data: message, error } = await supabase
      .from("inquiry_messages")
      .insert({ inquiry_id: data.inquiryId, sender_id: userId, body: data.body })
      .select("*")
      .single();
    if (error) throw error;

    await supabase
      .from("inquiries")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.inquiryId);

    void notifyInquiryParticipant(inquiry, userId, data.body);

    return message as InquiryMessageRecord;
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

    const propertyRows = (properties ?? []) as Property[];
    const leadRows = (leads ?? []) as InquiryRecord[];
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
