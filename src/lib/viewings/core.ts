import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { profileFromMap } from "@/lib/api/server-context";
import { requireRole } from "@/lib/api/_authz";
import { redactProfilePhone, resolveLeadContactAccess } from "@/lib/revenue/lead-access";

type Db = SupabaseClient<Database>;

export type ViewingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export type ViewingRow = Database["public"]["Tables"]["viewings"]["Row"];

export type ViewingListItem = ViewingRow & {
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
  leadContactsLocked?: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
};

function toViewingProfile(
  profile: ProfileRow | null | undefined,
): ViewingListItem["tenant_profile"] {
  if (!profile) return null;
  return {
    full_name: profile.full_name,
    phone: profile.phone,
    avatar_url: profile.avatar_url,
  };
}

function assertFutureViewingSlot(scheduledAt: Date) {
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
}

export async function bookViewingCore(
  admin: Db,
  tenantId: string,
  input: { propertyId: string; scheduledAt: string; notes?: string },
): Promise<ViewingRow> {
  const scheduledAt = new Date(input.scheduledAt);
  assertFutureViewingSlot(scheduledAt);

  const { data: property, error: propertyError } = await admin
    .from("properties")
    .select("id, owner_id, is_active, title")
    .eq("id", input.propertyId)
    .maybeSingle();
  if (propertyError) throw new Error(propertyError.message);
  if (!property?.is_active || !property.owner_id) {
    throw new Error("This property is not available for viewings");
  }
  const landlordId = property.owner_id;

  const { data: row, error } = await admin
    .from("viewings")
    .insert({
      property_id: input.propertyId,
      tenant_id: tenantId,
      landlord_id: landlordId,
      scheduled_at: scheduledAt.toISOString(),
      notes: input.notes?.trim() || null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Could not book this viewing");

  const { recordLead } = await import("@/lib/revenue/record-lead");
  void recordLead(admin, {
    listingId: input.propertyId,
    landlordId,
    tenantId,
    source: "booking",
  });

  const { notifyLandlordNewViewing, resolveTenantName } =
    await import("@/lib/notifications/rental-workflow-notify");
  void resolveTenantName(admin, tenantId).then((tenantName) =>
    notifyLandlordNewViewing(admin, {
      landlordId,
      viewingId: row.id,
      propertyTitle: property.title ?? "your listing",
      tenantName,
      scheduledAt: row.scheduled_at,
    }).catch((err) => console.warn("[viewings] notify landlord", err)),
  );

  return row;
}

export async function updateViewingStatusCore(
  admin: Db,
  userId: string,
  input: { viewingId: string; status: ViewingStatus },
): Promise<ViewingRow> {
  const { data: viewing, error: vErr } = await admin
    .from("viewings")
    .select("tenant_id, landlord_id, property_id, status, scheduled_at")
    .eq("id", input.viewingId)
    .single();

  if (vErr || !viewing) throw new Error("Viewing not found");
  if (viewing.status === input.status) {
    const { data: existing } = await admin
      .from("viewings")
      .select("*")
      .eq("id", input.viewingId)
      .single();
    if (!existing) throw new Error("Viewing not found");
    return existing;
  }

  if (viewing.tenant_id !== userId && viewing.landlord_id !== userId) {
    await requireRole(admin, userId, "admin");
  }

  const { data: row, error } = await admin
    .from("viewings")
    .update({ status: input.status })
    .eq("id", input.viewingId)
    .select("*")
    .single();

  if (error) throw error;

  const { data: property } = await admin
    .from("properties")
    .select("title")
    .eq("id", viewing.property_id)
    .maybeSingle();
  const { notifyViewingStatusChange } = await import("@/lib/notifications/rental-workflow-notify");
  void notifyViewingStatusChange(admin, {
    viewingId: row.id,
    propertyTitle: property?.title ?? "the listing",
    status: input.status,
    tenantId: viewing.tenant_id,
    landlordId: viewing.landlord_id,
    actorUserId: userId,
  }).catch((err) => console.warn("[viewings] notify status", err));

  return row;
}

export async function listViewingsForUser(admin: Db, userId: string): Promise<ViewingListItem[]> {
  const { data: rows, error } = await admin
    .from("viewings")
    .select("*")
    .or(`tenant_id.eq.${userId},landlord_id.eq.${userId}`)
    .order("scheduled_at", { ascending: true });

  if (error) throw error;
  if (!rows?.length) return [];

  const propertyIds = [...new Set(rows.map((r) => r.property_id))];
  const profileIds = [
    ...new Set(rows.flatMap((r) => [r.tenant_id, r.landlord_id].filter(Boolean) as string[])),
  ];

  const [{ data: properties }, { data: profiles }] = await Promise.all([
    admin
      .from("properties")
      .select("id, title, neighborhood, rent_kes, images")
      .in("id", propertyIds),
    admin.from("profiles").select("id, full_name, phone, avatar_url").in("id", profileIds),
  ]);

  const propertyMap = new Map((properties ?? []).map((p) => [p.id, p]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const leadAccess = await resolveLeadContactAccess(admin, userId);

  return rows.map((row) => {
    const isLandlordView = row.landlord_id === userId;
    const tenantProfile = profileMap.get(row.tenant_id) ?? null;
    return {
      ...row,
      properties: propertyMap.get(row.property_id) ?? null,
      tenant_profile: isLandlordView
        ? toViewingProfile(redactProfilePhone(tenantProfile, leadAccess.canView))
        : toViewingProfile(tenantProfile),
      landlord_profile: toViewingProfile(profileFromMap(row.landlord_id, profileMap)),
      leadContactsLocked: isLandlordView && !leadAccess.canView,
    };
  });
}

export async function listLandlordViewings(
  admin: Db,
  landlordId: string,
): Promise<ViewingListItem[]> {
  await requireRole(admin, landlordId, ["landlord", "manager", "agency"]);
  const all = await listViewingsForUser(admin, landlordId);
  return all.filter((row) => row.landlord_id === landlordId);
}

export async function listTenantViewings(admin: Db, tenantId: string): Promise<ViewingListItem[]> {
  const all = await listViewingsForUser(admin, tenantId);
  return all.filter((row) => row.tenant_id === tenantId);
}
