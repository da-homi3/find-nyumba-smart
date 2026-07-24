import { sendEmail } from "@/lib/email/send";
import { getSiteUrl } from "@/lib/site";
import type { PmDb } from "@/lib/pm/access";

type MaintenanceNotifyRow = {
  id: string;
  category: string;
  description: string;
  priority: string;
  unit_label: string;
  property_name: string;
  property_id: string;
  owner_user_id: string;
  tenant_name: string;
  tenant_user_id: string | null;
};

export async function loadMaintenanceNotifyContext(
  admin: PmDb,
  requestId: string,
): Promise<MaintenanceNotifyRow | null> {
  const { data: mr } = await admin
    .from("pm_maintenance_requests")
    .select("id, category, description, priority, unit_id, tenant_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!mr) return null;

  const { data: unit } = await admin
    .from("pm_units")
    .select("id, unit_label, property_id")
    .eq("id", mr.unit_id)
    .maybeSingle();
  if (!unit) return null;

  const { data: property } = await admin
    .from("pm_properties")
    .select("id, name, owner_user_id")
    .eq("id", unit.property_id)
    .maybeSingle();
  if (!property) return null;

  let tenantName = "Tenant";
  let tenantUserId: string | null = null;
  if (mr.tenant_id) {
    const { data: tenant } = await admin
      .from("pm_tenants")
      .select("full_name, tenant_user_id, portal_status")
      .eq("id", mr.tenant_id)
      .maybeSingle();
    tenantName = tenant?.full_name ?? tenantName;
    if (tenant?.portal_status === "accepted" && tenant.tenant_user_id) {
      tenantUserId = tenant.tenant_user_id;
    }
  }

  return {
    id: mr.id,
    category: mr.category,
    description: mr.description,
    priority: mr.priority,
    unit_label: unit.unit_label,
    property_name: property.name,
    property_id: property.id,
    owner_user_id: property.owner_user_id,
    tenant_name: tenantName,
    tenant_user_id: tenantUserId,
  };
}

async function profileEmail(_admin: PmDb, userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return data.user?.email?.trim() || null;
}

export async function notifyOwnerNewMaintenance(admin: PmDb, requestId: string): Promise<void> {
  const details = await loadMaintenanceNotifyContext(admin, requestId);
  if (!details) return;
  const email = await profileEmail(admin, details.owner_user_id);
  if (!email) return;

  const urgent = details.priority === "urgent";
  const subject = urgent
    ? `Urgent maintenance — ${details.property_name}, Unit ${details.unit_label}`
    : `New ${details.category} issue — ${details.property_name}`;
  const link = `${getSiteUrl()}/landlord/manage/${details.property_id}/maintenance`;
  const excerpt = details.description.slice(0, 160);

  await sendEmail({
    to: email,
    subject,
    templateId: urgent ? "maintenance_urgent" : "maintenance_new",
    text: `${details.tenant_name} reported a ${details.category} issue (${details.priority}): ${excerpt}\n\nOpen: ${link}`,
    html: `<p><strong>${details.tenant_name}</strong> reported a <strong>${details.category}</strong> issue (${details.priority}) for unit <strong>${details.unit_label}</strong>.</p><p>"${excerpt}"</p><p><a href="${link}">Open maintenance queue</a></p>${
      urgent
        ? `<p style="color:#dc2626">Urgent — also call your caretaker if this is a safety emergency.</p>`
        : ""
    }`,
    metadata: { requestId, propertyId: details.property_id },
  });
}

export async function notifyOwnerProviderDecision(
  admin: PmDb,
  requestId: string,
  accepted: boolean,
): Promise<void> {
  const details = await loadMaintenanceNotifyContext(admin, requestId);
  if (!details) return;
  const email = await profileEmail(admin, details.owner_user_id);
  if (!email) return;

  const link = `${getSiteUrl()}/landlord/manage/${details.property_id}/maintenance`;
  const subject = accepted
    ? `Provider accepted — ${details.category} · ${details.unit_label}`
    : `Provider declined — ${details.category} · ${details.unit_label}`;

  await sendEmail({
    to: email,
    subject,
    templateId: accepted ? "maintenance_provider_accepted" : "maintenance_provider_declined",
    text: accepted
      ? `A provider accepted the ${details.category} job for ${details.unit_label}. ${link}`
      : `A provider declined the ${details.category} job for ${details.unit_label}. Reassign from ${link}`,
    html: accepted
      ? `<p>A provider <strong>accepted</strong> the ${details.category} job for unit <strong>${details.unit_label}</strong>.</p><p><a href="${link}">View queue</a></p>`
      : `<p>A provider <strong>declined</strong> the ${details.category} job for unit <strong>${details.unit_label}</strong>. The request is back to <em>reported</em> — please reassign.</p><p><a href="${link}">View queue</a></p>`,
    metadata: { requestId },
  });
}

export async function promptTenantConfirmation(admin: PmDb, requestId: string): Promise<void> {
  const details = await loadMaintenanceNotifyContext(admin, requestId);
  // Spec: no portal account → landlord closes internally; skip prompt
  if (!details?.tenant_user_id) return;

  const email = await profileEmail(admin, details.tenant_user_id);
  if (!email) return;

  const link = `${getSiteUrl()}/tenant/maintenance`;
  await sendEmail({
    to: email,
    subject: `Confirm your ${details.category} fix — ${details.property_name}`,
    templateId: "maintenance_tenant_confirm",
    text: `Your ${details.category} issue at ${details.property_name} (unit ${details.unit_label}) was marked fixed. Confirm or reopen: ${link}`,
    html: `<p>Your <strong>${details.category}</strong> issue at <strong>${details.property_name}</strong> (unit ${details.unit_label}) was marked fixed.</p><p>Please <a href="${link}">confirm it is resolved</a>, or reopen it if the problem remains.</p>`,
    metadata: { requestId },
  });
}

export function buildProviderWhatsAppUrl(opts: {
  phone: string | null | undefined;
  category: string;
  description: string;
  acceptUrl: string;
  declineUrl: string;
}): string | null {
  const raw = opts.phone?.replace(/\D/g, "") ?? "";
  if (!raw) return null;
  let phone = raw;
  if (phone.startsWith("0")) phone = `254${phone.slice(1)}`;
  if (phone.length === 9) phone = `254${phone}`;

  const text = encodeURIComponent(
    `Hi, this is NyumbaSearch. A ${opts.category} job has come up: "${opts.description.slice(0, 120)}".\n\nAccept: ${opts.acceptUrl}\nDecline: ${opts.declineUrl}`,
  );
  return `https://wa.me/${phone}?text=${text}`;
}
