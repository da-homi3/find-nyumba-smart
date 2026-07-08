import type { Json } from "@/integrations/supabase/types";
import { getCacheKv } from "@/lib/kv/bindings";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertCategory =
  | "payment"
  | "auth"
  | "db"
  | "api"
  | "worker"
  | "security"
  | "queue"
  | "scaling"
  | "cron"
  | "email";

const DEDUP_WINDOWS: Record<AlertSeverity, number> = {
  critical: 300,
  warning: 1800,
  info: 3600,
};

function alertEmail(): string {
  return (
    process.env.OPS_ALERT_EMAIL ?? process.env.OPS_NOTIFICATION_EMAIL ?? "nyumbasearch101@gmail.com"
  );
}

function hashTitle(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = Math.trunc((hash << 5) - hash + (title.codePointAt(i) ?? 0));
  }
  return Math.abs(hash).toString(36);
}

function severityEmoji(severity: AlertSeverity): string {
  if (severity === "critical") return "[CRITICAL]";
  if (severity === "warning") return "[WARNING]";
  return "[INFO]";
}

function severityColor(severity: AlertSeverity): string {
  if (severity === "critical") return "#fc4a4a";
  if (severity === "warning") return "#f6ad55";
  return "#1eb88a";
}

async function isDuplicate(
  severity: AlertSeverity,
  category: AlertCategory,
  title: string,
): Promise<boolean> {
  const dedupeKey = `alert:${severity}:${category}:${hashTitle(title)}`;
  const kv = getCacheKv();
  if (kv) {
    const existing = await kv.get(dedupeKey);
    if (existing) return true;
    await kv.put(dedupeKey, "1", { expirationTtl: DEDUP_WINDOWS[severity] });
    return false;
  }
  return false;
}

async function persistAlert(
  severity: AlertSeverity,
  category: AlertCategory,
  title: string,
  context?: Record<string, unknown>,
): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = crypto.randomUUID();
    const { error } = await supabaseAdmin.from("alert_log").insert({
      id,
      severity,
      category,
      title,
      body: JSON.stringify(context ?? {}),
      context: (context ?? {}) as Json,
      resolved: false,
      notified: false,
    });
    if (error) {
      console.error("[alert] persist failed:", error.message);
      return null;
    }
    return id;
  } catch (e) {
    console.error("[alert] persist error:", e);
    return null;
  }
}

async function sendAlertEmail(
  severity: AlertSeverity,
  category: AlertCategory,
  title: string,
  context?: Record<string, unknown>,
  alertId?: string | null,
): Promise<void> {
  const emoji = severityEmoji(severity);
  const envLabel = process.env.MPESA_ENV === "production" ? "PRODUCTION" : "SANDBOX";

  const html = `<!DOCTYPE html><html><body style="font-family:monospace;background:#0d1117;color:#e6edf3;padding:24px">
    <h2 style="color:${severityColor(severity)}">
      ${emoji} [${severity.toUpperCase()}] NyumbaSearch — ${envLabel}
    </h2>
    <p><strong>Category:</strong> ${category}</p>
    <p><strong>Title:</strong> ${title}</p>
    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    ${alertId ? `<p><strong>Alert ID:</strong> ${alertId}</p>` : ""}
    ${context ? `<pre style="background:#161b22;padding:16px;border-radius:8px;overflow:auto">${JSON.stringify(context, null, 2)}</pre>` : ""}
  </body></html>`;

  const { sendEmail } = await import("@/lib/email/send");
  await sendEmail({
    to: alertEmail(),
    subject: `${emoji} [${severity.toUpperCase()}] ${title} — NyumbaSearch`,
    html,
    text: `${title}\n\n${JSON.stringify(context ?? {}, null, 2)}`,
    templateId: "ops-alert",
    metadata: { severity, category, alertId },
  });

  if (alertId) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("alert_log").update({ notified: true }).eq("id", alertId);
  }
}

export async function fireAlert(
  severity: AlertSeverity,
  category: AlertCategory,
  title: string,
  context?: Record<string, unknown>,
): Promise<void> {
  if (await isDuplicate(severity, category, title)) return;

  const alertId = await persistAlert(severity, category, title, context);

  if (severity === "critical") {
    await sendAlertEmail(severity, category, title, context, alertId).catch((e) =>
      console.error("[alert] email failed:", e),
    );
  }
}
