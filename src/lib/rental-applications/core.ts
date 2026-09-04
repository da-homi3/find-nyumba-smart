import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadTenantProfileBundle } from "@/lib/tenant/profile-bundle";
import {
  isActiveRentalApplicationStatus,
  type RentalApplicationStatus,
} from "@/lib/rental-applications/status";

export type { RentalApplicationStatus };

export type RentalApplicationRow = {
  id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  status: RentalApplicationStatus;
  message: string | null;
  move_in_date: string | null;
  tenant_score_percent: number | null;
  share_profile: boolean;
  landlord_notes: string | null;
  created_at: string;
  updated_at: string;
};

type Db = SupabaseClient<Database>;

export async function submitRentalApplication(
  admin: Db,
  tenantId: string,
  input: {
    propertyId: string;
    message?: string;
    moveInDate?: string;
    shareProfile?: boolean;
  },
): Promise<RentalApplicationRow> {
  const { data: property, error: propertyError } = await admin
    .from("properties")
    .select("id, owner_id, is_active, title")
    .eq("id", input.propertyId)
    .maybeSingle();
  if (propertyError) throw new Error(propertyError.message);
  if (!property?.is_active || !property.owner_id) {
    throw new Error("This property is not accepting applications");
  }
  if (property.owner_id === tenantId) {
    throw new Error("You cannot apply to your own listing");
  }

  const { data: existing } = await admin
    .from("rental_applications")
    .select("id, status")
    .eq("property_id", input.propertyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existing && isActiveRentalApplicationStatus(existing.status)) {
    throw new Error("You already have an active application for this property");
  }

  const bundle = await loadTenantProfileBundle(admin, tenantId);
  const moveInDate = input.moveInDate?.trim() || null;

  const { data: row, error } = await admin
    .from("rental_applications")
    .insert({
      property_id: input.propertyId,
      tenant_id: tenantId,
      landlord_id: property.owner_id,
      status: "submitted",
      message: input.message?.trim() || null,
      move_in_date: moveInDate,
      tenant_score_percent: bundle.score.percent,
      share_profile: input.shareProfile === true,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Could not submit application");

  const { recordLead } = await import("@/lib/revenue/record-lead");
  void recordLead(admin, {
    listingId: input.propertyId,
    landlordId: property.owner_id,
    tenantId,
    source: "application",
  });

  const { notifyLandlordNewApplication } =
    await import("@/lib/notifications/rental-workflow-notify");
  void notifyLandlordNewApplication(admin, {
    landlordId: property.owner_id,
    applicationId: row.id,
    propertyTitle: property.title ?? "your listing",
    tenantName: bundle.fullName,
    scorePercent: bundle.score.percent,
  }).catch((err) => console.warn("[applications] notify landlord", err));

  return row as RentalApplicationRow;
}

export async function withdrawRentalApplication(
  admin: Db,
  tenantId: string,
  applicationId: string,
): Promise<RentalApplicationRow> {
  const { data: row, error: fetchError } = await admin
    .from("rental_applications")
    .select("*")
    .eq("id", applicationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Application not found");
  if (!isActiveRentalApplicationStatus(row.status)) {
    throw new Error("This application can no longer be withdrawn");
  }

  const { data: updated, error } = await admin
    .from("rental_applications")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const [{ data: property }, tenantName] = await Promise.all([
    admin.from("properties").select("title").eq("id", updated.property_id).maybeSingle(),
    import("@/lib/notifications/rental-workflow-notify").then((m) =>
      m.resolveTenantName(admin, tenantId),
    ),
  ]);
  const { notifyLandlordApplicationWithdrawn } =
    await import("@/lib/notifications/rental-workflow-notify");
  void notifyLandlordApplicationWithdrawn(admin, {
    landlordId: updated.landlord_id,
    applicationId: updated.id,
    propertyTitle: property?.title ?? "your listing",
    tenantName,
  }).catch((err) => console.warn("[applications] notify withdraw", err));

  return updated as RentalApplicationRow;
}

export async function reviewRentalApplication(
  admin: Db,
  landlordId: string,
  input: {
    applicationId: string;
    status: "under_review" | "approved" | "rejected";
    landlordNotes?: string;
  },
): Promise<RentalApplicationRow> {
  const { data: row, error: fetchError } = await admin
    .from("rental_applications")
    .select("*")
    .eq("id", input.applicationId)
    .eq("landlord_id", landlordId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Application not found");
  if (row.status === "withdrawn") throw new Error("Application was withdrawn by the tenant");

  const { data: updated, error } = await admin
    .from("rental_applications")
    .update({
      status: input.status,
      landlord_notes: input.landlordNotes?.trim() || row.landlord_notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.applicationId)
    .eq("landlord_id", landlordId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (input.status !== row.status) {
    const { data: property } = await admin
      .from("properties")
      .select("title")
      .eq("id", updated.property_id)
      .maybeSingle();
    const { notifyTenantApplicationUpdate } =
      await import("@/lib/notifications/rental-workflow-notify");
    void notifyTenantApplicationUpdate(admin, {
      tenantId: updated.tenant_id,
      applicationId: updated.id,
      propertyTitle: property?.title ?? "the listing",
      status: updated.status as RentalApplicationStatus,
    }).catch((err) => console.warn("[applications] notify tenant", err));
  }

  return updated as RentalApplicationRow;
}

export async function listTenantApplications(admin: Db, tenantId: string) {
  const { data, error } = await admin
    .from("rental_applications")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RentalApplicationRow[];
  if (!rows.length) return [];

  const propertyIds = [...new Set(rows.map((r) => r.property_id))];
  const { data: properties } = await admin
    .from("properties")
    .select("id, title, neighborhood, rent_kes, images")
    .in("id", propertyIds);
  const propertyMap = new Map((properties ?? []).map((p) => [p.id, p]));

  return rows.map((row) => ({
    ...row,
    property: propertyMap.get(row.property_id) ?? null,
  }));
}

export async function listLandlordApplications(admin: Db, landlordId: string) {
  const { data, error } = await admin
    .from("rental_applications")
    .select("*")
    .eq("landlord_id", landlordId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RentalApplicationRow[];
  if (!rows.length) return [];

  const propertyIds = [...new Set(rows.map((r) => r.property_id))];
  const tenantIds = [...new Set(rows.map((r) => r.tenant_id))];

  const [{ data: properties }, { data: profiles }] = await Promise.all([
    admin
      .from("properties")
      .select("id, title, neighborhood, rent_kes, images")
      .in("id", propertyIds),
    admin.from("profiles").select("id, full_name, phone, avatar_url").in("id", tenantIds),
  ]);

  const propertyMap = new Map((properties ?? []).map((p) => [p.id, p]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((row) => ({
    ...row,
    property: propertyMap.get(row.property_id) ?? null,
    tenant_profile: profileMap.get(row.tenant_id) ?? null,
  }));
}
