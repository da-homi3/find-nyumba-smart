import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendEmail } from "@/lib/email/send";
import { baseLayout } from "@/lib/email/base-layout";

type Admin = SupabaseClient<Database>;

/** Retry failed email_log rows from the last 2 hours (daily/5-min cron). */
export async function runEmailRetryCron(
  admin: Admin,
): Promise<{ retried: number; succeeded: number }> {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: failed, error } = await admin
    .from("email_log")
    .select("id, to_email, subject, template_id, metadata")
    .eq("status", "failed")
    .gte("created_at", since)
    .limit(20);

  if (error || !failed?.length) return { retried: 0, succeeded: 0 };

  let succeeded = 0;
  for (const row of failed) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const body = `
      <h1>We're resending this message</h1>
      <p>This is a retry of: <strong>${row.subject}</strong></p>
      <p>If you already received it, you can ignore this email.</p>
    `;
    const ok = await sendEmail({
      to: row.to_email,
      templateId: `${row.template_id}-retry`,
      subject: row.subject,
      text: row.subject,
      html: baseLayout({ preheader: "Retry delivery", body }),
      metadata: { ...meta, retryOf: row.id },
    });
    if (ok) {
      succeeded += 1;
      await admin.from("email_log").update({ status: "sent" }).eq("id", row.id);
    }
  }

  return { retried: failed.length, succeeded };
}
