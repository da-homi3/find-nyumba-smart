import {
  adminNewApplicationEmail,
  newMessageEmail,
  portalApprovedEmail,
  portalRejectedEmail,
} from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { getSiteUrl } from "@/lib/site";

export const OPS_EMAIL = process.env.OPS_NOTIFICATION_EMAIL ?? "nyumbasearch101@gmail.com";

/** Partnership & advertising inquiries */
export const ADVERTISE_OPS_EMAIL = process.env.ADVERTISE_OPS_EMAIL ?? "nyumbasearch101@gmail.com";

/** @deprecated Use sendEmail from @/lib/email/send — kept for backward compatibility */
export async function sendEmailNotification(payload: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  return sendEmail({
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html ?? payload.text.replaceAll("\n", "<br>"),
    templateId: "legacy-plain",
  });
}

export async function notifyOpsNewApplication(opts: {
  applicantName: string;
  applicantEmail: string;
  role: string;
  orgName?: string;
  reviewUrl: string;
}) {
  const tpl = adminNewApplicationEmail(opts);
  return sendEmail({ to: OPS_EMAIL, templateId: "admin-new-application", ...tpl });
}

export async function notifyApplicantApproved(opts: { email: string; name: string; role: string }) {
  if (!opts.email) return false;
  const portalPaths: Record<string, string> = {
    landlord: "/landlord/dashboard",
    manager: "/manager/dashboard",
    agency: "/agency/dashboard",
    service_provider: "/services/provider/dashboard",
    "service provider": "/services/provider/dashboard",
  };
  const roleLabel = opts.role === "service_provider" ? "service provider" : opts.role;
  const tpl = portalApprovedEmail({
    name: opts.name,
    role: roleLabel,
    dashboardUrl: `${getSiteUrl()}${portalPaths[opts.role] ?? "/tenant"}`,
  });
  return sendEmail({ to: opts.email, templateId: "portal-approved", ...tpl });
}

export async function notifyApplicantRejected(opts: {
  email: string;
  name: string;
  role: string;
  reason?: string;
}) {
  if (!opts.email) return false;
  const tpl = portalRejectedEmail(opts);
  return sendEmail({ to: opts.email, templateId: "portal-rejected", ...tpl });
}

export async function notifyNewMessage(opts: {
  recipientEmail: string | null | undefined;
  recipientName: string;
  senderName: string;
  propertyTitle: string;
  preview: string;
  threadUrl: string;
}) {
  if (!opts.recipientEmail) return false;
  const tpl = newMessageEmail({
    recipientName: opts.recipientName,
    senderName: opts.senderName,
    propertyTitle: opts.propertyTitle,
    preview: opts.preview,
    threadUrl: opts.threadUrl,
  });
  return sendEmail({ to: opts.recipientEmail, templateId: "new-message", ...tpl });
}
