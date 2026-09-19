import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { notifyUsers } from "@/lib/notifications/notify-user";
import type { NotificationType } from "@/lib/notifications/types";
import { sendEmailResult } from "@/lib/email/send";
import { getSiteUrl } from "@/lib/site";

type Admin = SupabaseClient<Database>;

const PILOT_NOTIFY_TYPE: NotificationType = "announcement";

function toAbsoluteAdminHref(site: string, href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${site}${href}`;
  return `${site}/${href}`;
}

/** In-app alerts for pilot partnership events. */
export async function notifyPilotEvent(
  admin: Admin,
  input: {
    userIds: string[];
    title: string;
    body: string;
    href?: string;
  },
): Promise<void> {
  const ids = [...new Set(input.userIds.filter(Boolean))];
  if (!ids.length) return;
  await notifyUsers(admin, ids, {
    title: input.title,
    body: input.body,
    href: input.href ?? "/partner",
    type: PILOT_NOTIFY_TYPE,
  });
}

export async function notifyPilotOrgMembers(
  admin: Admin,
  organizationId: string | null | undefined,
  payload: { title: string; body: string; href?: string },
): Promise<void> {
  if (!organizationId) return;
  const { data: members } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId);
  await notifyPilotEvent(admin, {
    userIds: (members ?? []).map((m) => m.user_id),
    ...payload,
  });
}

async function resolveAdminNotifyEmails(admin: Admin, adminUserIds: string[]): Promise<string[]> {
  const emails = new Set<string>();
  const envExtra =
    process.env.PILOT_ADMIN_NOTIFY_EMAIL?.trim() ||
    process.env.ADMIN_NOTIFY_EMAIL?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    "";
  if (envExtra) {
    for (const part of envExtra.split(/[,;\s]+/)) {
      if (part.includes("@")) emails.add(part.toLowerCase());
    }
  }

  for (const userId of adminUserIds) {
    try {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error) continue;
      const email = data.user?.email?.trim().toLowerCase();
      if (email) emails.add(email);
    } catch {
      // Skip users we cannot resolve.
    }
  }
  return [...emails];
}

export async function notifyAdminsPilotAlert(
  admin: Admin,
  payload: {
    title: string;
    body: string;
    href?: string;
    /** When true, also email admins (in addition to in-app). Default true. */
    email?: boolean;
  },
): Promise<void> {
  const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const adminIds = (admins ?? []).map((r) => r.user_id);
  const href = payload.href ?? "/admin";
  await notifyPilotEvent(admin, {
    userIds: adminIds,
    title: payload.title,
    body: payload.body,
    href,
  });

  if (payload.email === false) return;

  const emails = await resolveAdminNotifyEmails(admin, adminIds);
  if (!emails.length) return;

  const site = getSiteUrl().replace(/\/$/, "");
  const absoluteHref = toAbsoluteAdminHref(site, href);
  const html = `
    <h1>${payload.title}</h1>
    <p>${payload.body}</p>
    <p style="text-align:center"><a class="btn" href="${absoluteHref}">Open in admin</a></p>
  `;
  const { baseLayout } = await import("@/lib/email/base-layout");
  await Promise.allSettled(
    emails.map((to) =>
      sendEmailResult({
        to,
        subject: payload.title,
        text: `${payload.body}\n\n${absoluteHref}`,
        html: baseLayout({ preheader: payload.title, body: html }),
        templateId: "pilot-admin-alert",
        metadata: { href },
      }),
    ),
  );
}
