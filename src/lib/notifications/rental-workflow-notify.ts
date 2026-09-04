import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { notifyUser } from "@/lib/notifications/notify-user";
import type { RentalApplicationStatus } from "@/lib/rental-applications/status";
import type { ViewingStatus } from "@/lib/viewings/core";

type Admin = SupabaseClient<Database>;

function formatStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function viewingStatusMessage(status: ViewingStatus): string {
  return (
    {
      pending: "is pending confirmation",
      confirmed: "has been confirmed",
      cancelled: "was cancelled",
      completed: "was marked completed",
    } as const
  )[status];
}

export async function notifyLandlordNewApplication(
  admin: Admin,
  input: {
    landlordId: string;
    applicationId: string;
    propertyTitle: string;
    tenantName: string;
    scorePercent: number | null;
  },
): Promise<void> {
  const scoreSuffix = input.scorePercent != null ? ` · ${input.scorePercent}% tenant profile` : "";
  await notifyUser(admin, {
    userId: input.landlordId,
    type: "lead",
    title: "New rental application",
    body: `${input.tenantName} applied for ${input.propertyTitle}${scoreSuffix}.`,
    href: "/landlord/applications",
    entityType: "rental_application",
    entityId: input.applicationId,
  });
}

export async function notifyTenantApplicationUpdate(
  admin: Admin,
  input: {
    tenantId: string;
    applicationId: string;
    propertyTitle: string;
    status: RentalApplicationStatus;
  },
): Promise<void> {
  if (input.status === "submitted") return;
  await notifyUser(admin, {
    userId: input.tenantId,
    type: "listing_match",
    title: "Application update",
    body: `Your application for ${input.propertyTitle} is now ${formatStatusLabel(input.status)}.`,
    href: "/tenant/applications",
    entityType: "rental_application",
    entityId: input.applicationId,
  });
}

export async function notifyLandlordApplicationWithdrawn(
  admin: Admin,
  input: {
    landlordId: string;
    applicationId: string;
    propertyTitle: string;
    tenantName: string;
  },
): Promise<void> {
  await notifyUser(admin, {
    userId: input.landlordId,
    type: "lead",
    title: "Application withdrawn",
    body: `${input.tenantName} withdrew their application for ${input.propertyTitle}.`,
    href: "/landlord/applications",
    entityType: "rental_application",
    entityId: input.applicationId,
  });
}

export async function notifyLandlordNewViewing(
  admin: Admin,
  input: {
    landlordId: string;
    viewingId: string;
    propertyTitle: string;
    tenantName: string;
    scheduledAt: string;
  },
): Promise<void> {
  const when = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(input.scheduledAt));
  await notifyUser(admin, {
    userId: input.landlordId,
    type: "lead",
    title: "New viewing request",
    body: `${input.tenantName} requested a viewing for ${input.propertyTitle} · ${when} EAT.`,
    href: "/landlord/viewings",
    entityType: "viewing",
    entityId: input.viewingId,
  });
}

export async function notifyViewingStatusChange(
  admin: Admin,
  input: {
    viewingId: string;
    propertyTitle: string;
    status: ViewingStatus;
    tenantId: string;
    landlordId: string;
    actorUserId: string;
  },
): Promise<void> {
  const message = `Your viewing for ${input.propertyTitle} ${viewingStatusMessage(input.status)}.`;
  const recipient = input.actorUserId === input.tenantId ? input.landlordId : input.tenantId;
  const href = recipient === input.tenantId ? "/viewings" : "/landlord/viewings";

  await notifyUser(admin, {
    userId: recipient,
    type: recipient === input.tenantId ? "listing_match" : "lead",
    title: "Viewing update",
    body: message,
    href,
    entityType: "viewing",
    entityId: input.viewingId,
  });
}

async function profileName(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return data?.full_name?.trim() || "A tenant";
}

export async function resolveTenantName(admin: Admin, userId: string): Promise<string> {
  return profileName(admin, userId);
}
