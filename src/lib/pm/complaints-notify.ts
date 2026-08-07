import { sendEmail } from "@/lib/email/send";
import { getSiteUrl } from "@/lib/site";
import type { PmDb } from "@/lib/pm/access";

type ComplaintNotifyRow = {
  id: string;
  subject: string;
  body: string;
  unit_label: string;
  property_name: string;
  property_id: string;
  owner_user_id: string;
  tenant_name: string;
  tenant_user_id: string | null;
};

export async function loadComplaintNotifyContext(
  admin: PmDb,
  complaintId: string,
): Promise<ComplaintNotifyRow | null> {
  const { data: row } = await admin
    .from("pm_complaints")
    .select("id, subject, body, unit_id, tenant_id, property_id")
    .eq("id", complaintId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return null;

  const { data: unit } = await admin
    .from("pm_units")
    .select("id, unit_label")
    .eq("id", row.unit_id)
    .maybeSingle();
  if (!unit) return null;

  const { data: property } = await admin
    .from("pm_properties")
    .select("id, name, owner_user_id")
    .eq("id", row.property_id)
    .maybeSingle();
  if (!property) return null;

  let tenantName = "Tenant";
  let tenantUserId: string | null = null;
  const { data: tenant } = await admin
    .from("pm_tenants")
    .select("full_name, tenant_user_id, portal_status")
    .eq("id", row.tenant_id)
    .maybeSingle();
  if (tenant) {
    tenantName = tenant.full_name ?? tenantName;
    if (tenant.portal_status === "accepted" && tenant.tenant_user_id) {
      tenantUserId = tenant.tenant_user_id;
    }
  }

  return {
    id: row.id,
    subject: row.subject,
    body: row.body,
    unit_label: unit.unit_label,
    property_name: property.name,
    property_id: property.id,
    owner_user_id: property.owner_user_id,
    tenant_name: tenantName,
    tenant_user_id: tenantUserId,
  };
}

async function profileEmail(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return data.user?.email?.trim() || null;
}

async function manageComplaintsPath(
  admin: PmDb,
  ownerUserId: string,
  propertyId: string,
): Promise<string> {
  const { data: profile } = await admin
    .from("profiles")
    .select("active_portal")
    .eq("id", ownerUserId)
    .maybeSingle();
  const portal = profile?.active_portal;
  let base = "landlord";
  if (portal === "agency") base = "agency";
  else if (portal === "manager") base = "manager";
  return `/${base}/manage/${propertyId}/complaints`;
}

export async function notifyOwnerNewComplaint(admin: PmDb, complaintId: string): Promise<void> {
  const details = await loadComplaintNotifyContext(admin, complaintId);
  if (!details) return;
  const email = await profileEmail(details.owner_user_id);
  const path = await manageComplaintsPath(admin, details.owner_user_id, details.property_id);
  const link = `${getSiteUrl()}${path}`;
  const excerpt = details.body.slice(0, 160);

  if (email) {
    await sendEmail({
      to: email,
      subject: `Tenant complaint — ${details.property_name}, Unit ${details.unit_label}`,
      templateId: "pm_complaint_new",
      text: `${details.tenant_name}: ${details.subject}\n${excerpt}\n\nOpen: ${link}`,
      html: `<p><strong>${details.tenant_name}</strong> filed a complaint for unit <strong>${details.unit_label}</strong>.</p><p><strong>${details.subject}</strong></p><p>"${excerpt}"</p><p><a href="${link}">Open complaints</a></p>`,
      metadata: { complaintId, propertyId: details.property_id },
    });
  }

  const { notifyUser } = await import("@/lib/notifications/notify-user");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await notifyUser(supabaseAdmin, {
    userId: details.owner_user_id,
    type: "complaint_new",
    title: `Complaint: ${details.subject}`,
    body: `${details.tenant_name} · Unit ${details.unit_label}`,
    href: path,
    entityType: "pm_complaint",
    entityId: complaintId,
  });
}

export async function notifyTenantComplaintReply(
  admin: PmDb,
  complaintId: string,
  reply: string,
): Promise<void> {
  const details = await loadComplaintNotifyContext(admin, complaintId);
  if (!details?.tenant_user_id) return;

  const email = await profileEmail(details.tenant_user_id);
  const link = `${getSiteUrl()}/tenant/complaints`;
  const excerpt = reply.slice(0, 200);

  if (email) {
    await sendEmail({
      to: email,
      subject: `Reply to your complaint — ${details.subject}`,
      templateId: "pm_complaint_reply",
      text: `Your landlord replied to "${details.subject}":\n\n${excerpt}\n\n${link}`,
      html: `<p>Your landlord replied to <strong>${details.subject}</strong>:</p><p>"${excerpt}"</p><p><a href="${link}">View complaints</a></p>`,
      metadata: { complaintId },
    });
  }

  const { notifyUser } = await import("@/lib/notifications/notify-user");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await notifyUser(supabaseAdmin, {
    userId: details.tenant_user_id,
    type: "complaint_reply",
    title: `Reply: ${details.subject}`,
    body: excerpt,
    href: "/tenant/complaints",
    entityType: "pm_complaint",
    entityId: complaintId,
  });
}
