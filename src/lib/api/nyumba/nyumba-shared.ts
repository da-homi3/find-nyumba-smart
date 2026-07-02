import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import type { Property } from "@/lib/properties";
import { ForbiddenError } from "@/lib/api/_authz";
import { getSiteUrl } from "@/lib/site";
import { normalizePropertyImages } from "@/lib/property-images";

export type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

export type InquiryRecord = Database["public"]["Tables"]["inquiries"]["Row"];
export type ProfileRecord = Database["public"]["Tables"]["profiles"]["Row"];
export type InquiryMessageRecord = Database["public"]["Tables"]["inquiry_messages"]["Row"];

export type InquiryWithDetails = InquiryRecord & {
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

export const propertyTypeSchema = z.enum(propertyTypes);

export const listPropertiesSchema = z
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
    limit: z.number().int().min(1).max(500).default(50),
    offset: z.number().int().min(0).default(0),
    sortBy: z.enum(["newest", "price_asc", "price_desc", "score"]).default("newest"),
  })
  .optional();

export const propertyIdSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().trim().max(128).optional(),
  source: z.string().trim().max(64).optional(),
});

export const propertyPayloadSchema = z.object({
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

export const createInquirySchema = z.object({
  propertyId: z.string().uuid(),
  message: z.string().trim().min(3).max(1000),
});

export const updateInquiryStatusSchema = z.object({
  inquiryId: z.string().uuid(),
  status: z.enum(["new", "contacted", "viewing", "closed", "archived"]),
});

export const sendInquiryMessageSchema = z.object({
  inquiryId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
});

export const inquiryIdSchema = z.object({ inquiryId: z.string().uuid() });

type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
type PropertyRowInput = Omit<PropertyRow, "organization_id" | "owner_id"> & {
  organization_id?: string | null;
  owner_id?: string | null;
};

export function mapPropertyRow(row: PropertyRowInput): Property {
  return {
    id: row.id,
    owner_id: row.owner_id ?? null,
    title: row.title,
    property_type: propertyTypeSchema.parse(row.property_type),
    neighborhood: row.neighborhood,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    rent_kes: row.rent_kes,
    deposit_kes: row.deposit_kes,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    area_sqm: row.area_sqm,
    description: row.description,
    amenities: row.amenities ?? [],
    images: normalizePropertyImages(row.images, row.id),
    video_url: row.video_url,
    tour_url: row.tour_url,
    is_verified: row.is_verified,
    is_active: row.is_active,
    is_vacant: row.is_vacant ?? undefined,
    organization_id: row.organization_id ?? null,
    authenticity_score: row.authenticity_score ?? undefined,
    health_score: row.health_score ?? undefined,
    available_from: row.available_from,
    views: row.views,
    created_at: row.created_at,
    updated_at: row.updated_at,
    featured_until: row.featured_until ?? undefined,
    boost_package: row.boost_package ?? undefined,
    nyumba_verified_at: row.nyumba_verified_at ?? undefined,
  };
}

export function mapPropertyRows(rows: PropertyRowInput[]): Property[] {
  return rows.map(mapPropertyRow);
}

type InquiryPropertyJoin = Pick<
  Property,
  "id" | "title" | "neighborhood" | "rent_kes" | "images"
> & {
  organization_id?: string | null;
  owner_id?: string | null;
};

export function mapInquiryWithDetails(
  row: InquiryRecord & Record<string, unknown>,
): InquiryWithDetails {
  const properties = row.properties as
    | InquiryPropertyJoin
    | InquiryPropertyJoin[]
    | null
    | undefined;
  const normalizedProperties = Array.isArray(properties) ? properties[0] : properties;
  return {
    ...row,
    properties: normalizedProperties ?? null,
    profiles: (row.profiles as InquiryWithDetails["profiles"]) ?? null,
    inquiry_messages: (row.inquiry_messages as InquiryMessageRecord[] | undefined) ?? [],
  };
}

function isAuthContext(ctx: unknown): ctx is AuthContext {
  return (
    typeof ctx === "object" &&
    ctx !== null &&
    "supabase" in ctx &&
    "userId" in ctx &&
    typeof (ctx as AuthContext).userId === "string" &&
    (ctx as AuthContext).supabase != null
  );
}

export function authContext(context: unknown): AuthContext {
  if (!isAuthContext(context)) throw new Error("Unauthorized");
  return context;
}

function inquiryPropertyOrgId(property: unknown): string | null | undefined {
  if (!property || typeof property !== "object" || !("organization_id" in property)) {
    return undefined;
  }
  const orgId = (property as { organization_id?: string | null }).organization_id;
  return orgId ?? null;
}

export async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getUserOrganizationId(
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

type ManageableProperty = Pick<
  PropertyRow,
  "id" | "owner_id" | "organization_id" | "images" | "video_url" | "tour_url"
>;

export async function assertCanManageProperty(
  supabase: SupabaseClient<Database>,
  userId: string,
  propertyId: string,
): Promise<ManageableProperty> {
  const admin = await adminClient();
  const { data: property, error } = await admin
    .from("properties")
    .select("id, owner_id, organization_id, images, video_url, tour_url")
    .eq("id", propertyId)
    .maybeSingle();
  if (error) throw error;
  if (!property) throw new Error("Property not found");

  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = new Set((roleRows ?? []).map((r) => r.role));

  let allowed = property.owner_id === userId;
  if (!allowed && (roles.has("manager") || roles.has("agency")) && property.organization_id) {
    const orgId = await getUserOrganizationId(supabase, userId);
    allowed = orgId === property.organization_id;
  }
  if (!allowed) throw new ForbiddenError("You cannot update this property");

  return property;
}

export async function assertInquiryParticipant(
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
    const propertyOrgId = inquiryPropertyOrgId(inquiry.properties);
    if (orgId && propertyOrgId === orgId) {
      return inquiry;
    }
  }

  throw new ForbiddenError("Forbidden: not a participant in this conversation");
}

export async function notifyInquiryParticipant(
  inquiry: InquiryRecord & { properties?: { title?: string } | null },
  senderId: string,
  body: string,
) {
  const recipientId = inquiry.tenant_id === senderId ? inquiry.landlord_id : inquiry.tenant_id;
  if (!recipientId) return;
  const admin = await adminClient();

  const { shouldSendMessageEmail } = await import("@/lib/email/prefs");
  if (!(await shouldSendMessageEmail(admin, recipientId))) return;

  const [{ data: senderProfile }, { data: recipientProfile }, recipientAuth] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", senderId).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", recipientId).maybeSingle(),
    admin.auth.admin.getUserById(recipientId),
  ]);

  const { notifyNewMessage } = await import("@/lib/api/notify");
  const baseUrl = getSiteUrl();
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
