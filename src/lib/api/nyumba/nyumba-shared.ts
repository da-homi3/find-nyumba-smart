import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import type { Property } from "@/lib/properties";
import { ForbiddenError } from "@/lib/api/_authz";
import { getSiteUrl } from "@/lib/site";

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
    limit: z.number().int().min(1).max(100).default(50),
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

export function authContext(context: unknown): AuthContext {
  const ctx = context as Partial<AuthContext>;
  if (!ctx.supabase || !ctx.userId) throw new Error("Unauthorized");
  return { supabase: ctx.supabase, userId: ctx.userId };
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
    const property = inquiry.properties as { organization_id?: string | null } | null;
    if (orgId && property?.organization_id === orgId) {
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
