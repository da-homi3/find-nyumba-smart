import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const bookViewingSchema = z.object({
  propertyId: z.string().uuid(),
  landlordId: z.string().uuid(),
  scheduledAt: z.string(),
  notes: z.string().trim().max(500).optional(),
});

const updateViewingStatusSchema = z.object({
  viewingId: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
});

function getContext(context: unknown) {
  const c = context as { supabase: SupabaseClient<Database>; userId: string };
  if (!c?.supabase || !c?.userId) throw new Error("Unauthorized");
  return c;
}

export const bookViewing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(bookViewingSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getContext(context);
    await requireRole(supabase, userId, "tenant");

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, owner_id, is_active")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (propertyError) throw propertyError;
    if (!property?.is_active || !property.owner_id) {
      throw new Error("This property is not available for viewings");
    }
    if (property.owner_id !== data.landlordId) {
      throw new Error("Invalid landlord for this property");
    }

    const { data: row, error } = await supabase
      .from("viewings")
      .insert({
        property_id: data.propertyId,
        tenant_id: userId,
        landlord_id: property.owner_id,
        scheduled_at: data.scheduledAt,
        notes: data.notes ?? null,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) throw error;
    return row;
  });

export const updateViewingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(updateViewingStatusSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getContext(context);

    // Verify user is either the tenant, the landlord, or an admin
    const { data: viewing, error: vErr } = await supabase
      .from("viewings")
      .select("tenant_id, landlord_id")
      .eq("id", data.viewingId)
      .single();

    if (vErr || !viewing) throw new Error("Viewing not found");

    if (viewing.tenant_id !== userId && viewing.landlord_id !== userId) {
      // Check if admin
      await requireRole(supabase, userId, "admin");
    }

    const { data: row, error } = await supabase
      .from("viewings")
      .update({ status: data.status })
      .eq("id", data.viewingId)
      .select("*")
      .single();

    if (error) throw error;
    return row;
  });

export type ViewingListItem = Database["public"]["Tables"]["viewings"]["Row"] & {
  properties: {
    id: string;
    title: string;
    neighborhood: string;
    rent_kes: number;
    images: string[];
  } | null;
  tenant_profile: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  landlord_profile: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
};

export const listMyViewings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getContext(context);

    const { data: rows, error } = await supabase
      .from("viewings")
      .select("*")
      .or(`tenant_id.eq.${userId},landlord_id.eq.${userId}`)
      .order("scheduled_at", { ascending: true });

    if (error) throw error;
    if (!rows?.length) return [] as ViewingListItem[];

    const propertyIds = [...new Set(rows.map((r) => r.property_id))];
    const profileIds = [
      ...new Set(rows.flatMap((r) => [r.tenant_id, r.landlord_id].filter(Boolean) as string[])),
    ];

    const [{ data: properties }, { data: profiles }] = await Promise.all([
      supabase
        .from("properties")
        .select("id, title, neighborhood, rent_kes, images")
        .in("id", propertyIds),
      supabase.from("profiles").select("id, full_name, phone, avatar_url").in("id", profileIds),
    ]);

    const propertyMap = new Map((properties ?? []).map((p) => [p.id, p]));
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return rows.map((row) => ({
      ...row,
      properties: propertyMap.get(row.property_id) ?? null,
      tenant_profile: profileMap.get(row.tenant_id) ?? null,
      landlord_profile: row.landlord_id ? (profileMap.get(row.landlord_id) ?? null) : null,
    })) as ViewingListItem[];
  });
