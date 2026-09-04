import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuthContext } from "@/lib/api/server-context";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import {
  bookViewingCore,
  listViewingsForUser,
  updateViewingStatusCore,
  type ViewingListItem,
} from "@/lib/viewings/core";

export type { ViewingListItem };

const bookViewingSchema = z.object({
  propertyId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(500).optional(),
});

const updateViewingStatusSchema = z.object({
  viewingId: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
});

export const bookViewing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(bookViewingSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return bookViewingCore(supabaseAdmin, userId, data);
  });

export const updateViewingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(updateViewingStatusSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return updateViewingStatusCore(supabaseAdmin, userId, data);
  });

export const listMyViewings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return listViewingsForUser(supabaseAdmin, userId);
  });

/** Latest active viewing status per property for landlord/manager/agency portfolio. */
export const listPortfolioViewingStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin;

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = new Set((roleRows ?? []).map((r) => r.role));

    let propertyIds: string[] = [];
    if (roles.has("manager") || roles.has("agency")) {
      const { data: member } = await admin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (member?.organization_id) {
        const { data: props } = await admin
          .from("properties")
          .select("id")
          .eq("organization_id", member.organization_id);
        propertyIds = (props ?? []).map((p) => p.id);
      }
    }
    if (propertyIds.length === 0) {
      const { data: props } = await admin.from("properties").select("id").eq("owner_id", userId);
      propertyIds = (props ?? []).map((p) => p.id);
    }
    if (propertyIds.length === 0) return [] as { property_id: string; status: string }[];

    const { data: viewings, error } = await admin
      .from("viewings")
      .select("property_id, status, scheduled_at")
      .in("property_id", propertyIds)
      .in("status", ["pending", "confirmed"])
      .order("scheduled_at", { ascending: false });

    if (error) throw error;

    const byProperty = new Map<string, string>();
    for (const v of viewings ?? []) {
      if (!byProperty.has(v.property_id)) byProperty.set(v.property_id, v.status);
    }
    return [...byProperty.entries()].map(([property_id, status]) => ({ property_id, status }));
  });
