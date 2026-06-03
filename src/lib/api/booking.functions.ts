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

    const { data: row, error } = await supabase
      .from("viewings")
      .insert({
        property_id: data.propertyId,
        tenant_id: userId,
        landlord_id: data.landlordId,
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

export const listMyViewings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getContext(context);

    const { data: rows, error } = await supabase
      .from("viewings")
      .select(`
        *,
        properties (
          id,
          title,
          neighborhood,
          rent_kes,
          images
        ),
        tenant_profile:profiles!viewings_tenant_id_fkey(full_name, phone, avatar_url),
        landlord_profile:profiles!viewings_landlord_id_fkey(full_name, phone, avatar_url)
      `)
      .or(`tenant_id.eq.${userId},landlord_id.eq.${userId}`)
      .order("scheduled_at", { ascending: true });

    if (error) throw error;
    return rows;
  });
