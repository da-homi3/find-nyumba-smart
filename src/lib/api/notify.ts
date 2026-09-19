import {
  adminNewApplicationEmail,
  adminNewListingEmail,
  newMessageEmail,
  orgTeamApprovedEmail,
  orgTeamInviteEmail,
  portalApprovedEmail,
  portalRejectedEmail,
} from "@/lib/email/templates";
import { sendEmailResult } from "@/lib/email/send";
import { getSiteUrl } from "@/lib/site";
import { listerDashboardPath } from "@/lib/portal-guard";

export const OPS_EMAIL = process.env.OPS_NOTIFICATION_EMAIL ?? "nyumbasearch101@gmail.com";

/** Partnership & advertising inquiries */
export const ADVERTISE_OPS_EMAIL = process.env.ADVERTISE_OPS_EMAIL ?? "nyumbasearch101@gmail.com";

async function inApp(
  userId: string | undefined,
  payload: {
    type: "portal" | "message" | "account";
    title: string;
    body: string;
    href: string;
  },
) {
  if (!userId) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyUser } = await import("@/lib/notifications/notify-user");
    await notifyUser(supabaseAdmin, { userId, ...payload });
  } catch (err) {
    console.warn("[notify] in-app failed", err);
  }
}

/** @deprecated Prefer sendEmailResult from @/lib/email/send */
export async function sendEmailNotification(payload: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const result = await sendEmailResult({
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html ?? payload.text.replaceAll("\n", "<br>"),
    templateId: "legacy-plain",
  });
  return result.ok;
}

export async function notifyOpsNewApplication(opts: {
  applicantName: string;
  applicantEmail: string;
  role: string;
  orgName?: string;
  reviewUrl: string;
}) {
  const tpl = adminNewApplicationEmail(opts);
  const result = await sendEmailResult({
    to: OPS_EMAIL,
    templateId: "admin-new-application",
    ...tpl,
  });
  return result.ok;
}

export async function notifyOpsNewListing(opts: {
  propertyId: string;
  title: string;
  neighborhood: string;
  rentKes?: number | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  /** e.g. web, mobile, whatsapp, bulk-import, admin */
  source?: string;
}) {
  try {
    const site = getSiteUrl().replace(/\/$/, "");
    let ownerName = opts.ownerName?.trim() || "Lister";
    let ownerEmail = opts.ownerEmail?.trim() || "unknown";

    if (opts.ownerUserId && (!opts.ownerEmail || !opts.ownerName)) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ data: authUser }, { data: profile }] = await Promise.all([
          supabaseAdmin.auth.admin.getUserById(opts.ownerUserId),
          supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("id", opts.ownerUserId)
            .maybeSingle(),
        ]);
        ownerEmail = opts.ownerEmail?.trim() || authUser.user?.email || ownerEmail;
        ownerName =
          opts.ownerName?.trim() ||
          profile?.full_name ||
          (authUser.user?.user_metadata?.full_name as string | undefined) ||
          ownerName;
      } catch (err) {
        console.warn("[notify] owner lookup failed", err);
      }
    }

    const tpl = adminNewListingEmail({
      title: opts.title,
      neighborhood: opts.neighborhood,
      rentKes: opts.rentKes ?? null,
      ownerName,
      ownerEmail,
      source: opts.source ?? "web",
      listingUrl: `${site}/property/${opts.propertyId}`,
      adminUrl: `${site}/admin/listings/${opts.propertyId}/edit`,
      propertyType: opts.propertyType,
      bedrooms: opts.bedrooms,
    });
    const result = await sendEmailResult({
      to: OPS_EMAIL,
      templateId: "admin-new-listing",
      ...tpl,
    });
    return result.ok;
  } catch (err) {
    console.warn("[notify] ops new listing failed", err);
    return false;
  }
}

export async function notifyApplicantApproved(opts: {
  email: string;
  name: string;
  role: string;
  userId?: string;
}) {
  if (!opts.email) return false;
  const portalPaths: Record<string, string> = {
    landlord: listerDashboardPath("landlord"),
    manager: listerDashboardPath("manager"),
    agency: listerDashboardPath("agency"),
    property_developer: listerDashboardPath("property_developer"),
    agent: listerDashboardPath("agent"),
    service_provider: "/services/provider/dashboard",
    "service provider": "/services/provider/dashboard",
  };
  const roleLabel = opts.role === "service_provider" ? "service provider" : opts.role;
  const dashboardPath = portalPaths[opts.role] ?? "/tenant";
  const tpl = portalApprovedEmail({
    name: opts.name,
    role: roleLabel,
    dashboardUrl: `${getSiteUrl()}${dashboardPath}`,
  });
  const result = await sendEmailResult({ to: opts.email, templateId: "portal-approved", ...tpl });
  await inApp(opts.userId, {
    type: "portal",
    title: "Application approved",
    body: `Your ${roleLabel} application was approved. Welcome aboard.`,
    href: dashboardPath,
  });
  return result.ok;
}

export async function notifyApplicantRejected(opts: {
  email: string;
  name: string;
  role: string;
  reason?: string;
  userId?: string;
}) {
  if (!opts.email) return false;
  const tpl = portalRejectedEmail(opts);
  const result = await sendEmailResult({ to: opts.email, templateId: "portal-rejected", ...tpl });
  await inApp(opts.userId, {
    type: "portal",
    title: "Application update",
    body: opts.reason?.trim()
      ? `Your application was not approved: ${opts.reason.slice(0, 160)}`
      : "Your application was not approved. You can re-apply later.",
    href: "/settings",
  });
  return result.ok;
}

export async function notifyNewMessage(opts: {
  recipientEmail: string | null | undefined;
  recipientName: string;
  senderName: string;
  propertyTitle: string;
  preview: string;
  threadUrl: string;
  recipientUserId?: string;
}) {
  let ok = false;
  if (opts.recipientEmail) {
    const tpl = newMessageEmail({
      recipientName: opts.recipientName,
      senderName: opts.senderName,
      propertyTitle: opts.propertyTitle,
      preview: opts.preview,
      threadUrl: opts.threadUrl,
    });
    const result = await sendEmailResult({
      to: opts.recipientEmail,
      templateId: "new-message",
      ...tpl,
    });
    ok = result.ok;
  }
  const href = opts.threadUrl.replace(getSiteUrl(), "") || opts.threadUrl;
  await inApp(opts.recipientUserId, {
    type: "message",
    title: `Message from ${opts.senderName}`,
    body: opts.preview.slice(0, 160) || `About ${opts.propertyTitle}`,
    href,
  });
  return ok;
}

export async function notifyOrgTeamInvited(opts: {
  email: string;
  inviteeName: string;
  inviterName: string;
  organizationName: string;
  portalLabel: string;
  signInUrl: string;
  isNewAccount: boolean;
  setupPasswordUrl?: string;
  otpCode?: string;
  userId?: string;
}) {
  if (!opts.email) return false;
  const tpl = orgTeamInviteEmail(opts);
  const result = await sendEmailResult({ to: opts.email, templateId: "org-team-invite", ...tpl });
  await inApp(opts.userId, {
    type: "account",
    title: `Team invite — ${opts.organizationName}`,
    body: `${opts.inviterName} invited you to join as ${opts.portalLabel}.`,
    href: opts.signInUrl.replace(getSiteUrl(), "") || "/auth",
  });
  return result.ok;
}

export async function notifyOrgTeamApproved(opts: {
  email: string;
  inviteeName: string;
  organizationName: string;
  portalType: "agency" | "property_manager";
  userId?: string;
}) {
  if (!opts.email) return false;
  const portalLabel = opts.portalType === "property_manager" ? "property manager" : "agency";
  const dashboardPath =
    opts.portalType === "property_manager" ? "/manager/dashboard" : "/agency/dashboard";
  const tpl = orgTeamApprovedEmail({
    inviteeName: opts.inviteeName,
    organizationName: opts.organizationName,
    portalLabel,
    dashboardUrl: `${getSiteUrl()}${dashboardPath}`,
  });
  const result = await sendEmailResult({
    to: opts.email,
    templateId: "org-team-approved",
    ...tpl,
  });
  await inApp(opts.userId, {
    type: "account",
    title: "Team access approved",
    body: `You're in on ${opts.organizationName}.`,
    href: dashboardPath,
  });
  return result.ok;
}
