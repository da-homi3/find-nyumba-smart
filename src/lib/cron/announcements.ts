import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendEmail } from "@/lib/email/send";
import { baseLayout } from "@/lib/email/base-layout";
import { sanitiseText } from "@/lib/security/sanitize";

type Admin = SupabaseClient<Database>;

export type ProductAnnouncement = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  targetRoles: Array<"tenant" | "landlord" | "agency" | "manager" | "all">;
};

/** Broadcast a product update to opted-in users (admin-triggered). */
export async function sendProductAnnouncement(
  admin: Admin,
  announcement: ProductAnnouncement,
  adminId?: string,
): Promise<{ sent: number; skipped: number }> {
  const title = sanitiseText(announcement.title, 200);
  const body = sanitiseText(announcement.body, 5000);
  const ctaLabel = sanitiseText(announcement.ctaLabel, 80);
  const ctaUrl = sanitiseText(announcement.ctaUrl, 500);
  const roles = announcement.targetRoles.includes("all")
    ? null
    : announcement.targetRoles.filter((role) => role !== "all");

  let userIds: string[] = [];
  if (roles) {
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("role", roles);
    userIds = [...new Set((roleRows ?? []).map((r) => r.user_id))];
  } else {
    const { data: profiles } = await admin.from("profiles").select("id").limit(2000);
    userIds = (profiles ?? []).map((p) => p.id);
  }

  let sent = 0;
  let skipped = 0;
  const tplId = `announcement-${Date.now()}`;

  for (const userId of userIds) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email_marketing_opt_in")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.email_marketing_opt_in === false) {
      skipped += 1;
      continue;
    }

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const email = authUser.user?.email;
    if (!email) {
      skipped += 1;
      continue;
    }

    const name =
      (authUser.user?.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
    const htmlBody = `
      <h1>${title}</h1>
      <p>Hi ${name},</p>
      <p>${body}</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${ctaUrl}?ref=announcement" class="btn">${ctaLabel}</a>
      </p>
    `;
    await sendEmail({
      to: email,
      templateId: "product_announcement",
      subject: `New on NyumbaSearch — ${title}`,
      text: body,
      html: baseLayout({ preheader: body.slice(0, 90), body: htmlBody }),
      metadata: { announcementTpl: tplId, userId },
    });
    sent += 1;
  }

  await admin.from("admin_audit_logs").insert({
    admin_id: adminId ?? null,
    action: "PRODUCT_ANNOUNCEMENT",
    details: JSON.stringify({ title, sent, skipped, roles: announcement.targetRoles }),
  });

  return { sent, skipped };
}

/** Batch helper for large sends with rate pacing. */
export async function sendProductAnnouncementBatched(
  admin: Admin,
  announcement: ProductAnnouncement,
): Promise<{ sent: number; skipped: number }> {
  return sendProductAnnouncement(admin, announcement);
}
