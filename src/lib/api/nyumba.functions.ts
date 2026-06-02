import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { Property, PropertyType } from "@/lib/properties";
import { requireRole } from "@/lib/api/_authz";

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
    maxRent: z.number().int().positive().optional(),
    verifiedOnly: z.boolean().optional(),
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

function authContext(context: unknown): AuthContext {
  const ctx = context as Partial<AuthContext>;
  if (!ctx.supabase || !ctx.userId) throw new Error("Unauthorized");
  return { supabase: ctx.supabase, userId: ctx.userId };
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listProperties = createServerFn({ method: "POST" })
  .inputValidator(listPropertiesSchema)
  .handler(async ({ data }) => {
    const supabase = await adminClient();
    let query = supabase
      .from("properties")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (data?.neighborhood && data.neighborhood !== "All") {
      query = query.eq("neighborhood", data.neighborhood);
    }
    if (data?.propertyType) query = query.eq("property_type", data.propertyType);
    if (data?.maxRent) query = query.lte("rent_kes", data.maxRent);
    if (data?.verifiedOnly) query = query.eq("is_verified", true);
    if (data?.query) {
      const term = data.query.replaceAll(",", " ").trim();
      query = query.or(
        `title.ilike.%${term}%,neighborhood.ilike.%${term}%,property_type.eq.${term.replaceAll(" ", "_")}`,
      );
    }

    const { data: rows, error } = await query;
    if (error) throw error;
    return (rows ?? []) as Property[];
  });

export const getProperty = createServerFn({ method: "POST" })
  .inputValidator(propertyIdSchema)
  .handler(async ({ data }) => {
    const supabase = await adminClient();
    const { data: property, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw error;
    if (!property || !property.is_active) return null;

    await supabase
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

export const createProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(propertyPayloadSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "landlord");
    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        ...data,
        owner_id: userId,
        property_type: data.property_type as PropertyType,
      })
      .select("*")
      .single();

    if (error) throw error;
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

    const { data: inquiry, error } = await supabase
      .from("inquiries")
      .insert({
        tenant_id: userId,
        landlord_id: property.owner_id,
        property_id: property.id,
        message: data.message,
      })
      .select("*")
      .single();

    if (error) throw error;

    const { error: messageError } = await supabase.from("inquiry_messages").insert({
      inquiry_id: inquiry.id,
      sender_id: userId,
      body: data.message,
    });
    if (messageError) throw messageError;

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
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as InquiryWithDetails[];
  });

export const listLandlordLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
    await requireRole(supabase, userId, "landlord");
    const { data, error } = await supabase
      .from("inquiries")
      .select(
        "*, properties(id,title,neighborhood,rent_kes,images), profiles:tenant_id(id,full_name,phone,avatar_url), inquiry_messages(*)",
      )
      .eq("landlord_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as InquiryWithDetails[];
  });

export const updateInquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(updateInquiryStatusSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    const { data: inquiry, error } = await supabase
      .from("inquiries")
      .update({ status: data.status })
      .eq("id", data.inquiryId)
      .eq("landlord_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return inquiry as InquiryRecord;
  });

export const sendInquiryMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sendInquiryMessageSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = authContext(context);
    const { data: message, error } = await supabase
      .from("inquiry_messages")
      .insert({ inquiry_id: data.inquiryId, sender_id: userId, body: data.body })
      .select("*")
      .single();

    if (error) throw error;
    return message as InquiryMessageRecord;
  });

export const getLandlordDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = authContext(context);
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
