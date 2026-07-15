import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuthContext, profileFromMap } from "@/lib/api/server-context";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { redactProfilePhone, resolveLeadContactAccess } from "@/lib/revenue/lead-access";

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
    const { supabase, userId } = getAuthContext(context);

    const scheduledAt = new Date(data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new TypeError("Invalid viewing date or time");
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new Error("Please choose a future date and time for your viewing");
    }
    const eatWeekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Nairobi",
      weekday: "short",
    }).format(scheduledAt);
    if (eatWeekday === "Sun") {
      throw new Error("Viewings are not available on Sundays");
    }

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, owner_id, is_active")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (propertyError) throw new Error(propertyError.message);
    if (!property?.is_active || !property.owner_id) {
      throw new Error("This property is not available for viewings");
    }

    const { data: row, error } = await supabase
      .from("viewings")
      .insert({
        property_id: data.propertyId,
        tenant_id: userId,
        landlord_id: property.owner_id,
        scheduled_at: scheduledAt.toISOString(),
        notes: data.notes ?? null,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message || "Could not book this viewing");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordLead } = await import("@/lib/revenue/record-lead");
    void recordLead(supabaseAdmin, {
      listingId: data.propertyId,
      landlordId: property.owner_id,
      tenantId: userId,
      source: "booking",
    });

    return row;
  });

export const updateViewingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(updateViewingStatusSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: viewing, error: vErr } = await supabaseAdmin
      .from("viewings")
      .select("tenant_id, landlord_id")
      .eq("id", data.viewingId)
      .single();

    if (vErr || !viewing) throw new Error("Viewing not found");

    if (viewing.tenant_id !== userId && viewing.landlord_id !== userId) {
      await requireRole(supabase, userId, "admin");
    }

    const { data: row, error } = await supabaseAdmin
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

export const listMyViewings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);

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

    const leadAccess = await resolveLeadContactAccess(supabase, userId);

    return rows.map((row) => {
      const isLandlordView = row.landlord_id === userId;
      const tenantProfile = profileMap.get(row.tenant_id) ?? null;
      return {
        ...row,
        properties: propertyMap.get(row.property_id) ?? null,
        tenant_profile: isLandlordView
          ? redactProfilePhone(tenantProfile, leadAccess.canView)
          : tenantProfile,
        landlord_profile: profileFromMap(row.landlord_id, profileMap),
        leadContactsLocked: isLandlordView && !leadAccess.canView,
      };
    }) as ViewingListItem[];
  });
