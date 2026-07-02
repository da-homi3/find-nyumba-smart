import sgMail from "@sendgrid/mail";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
  templateId?: string;
  metadata?: Record<string, unknown>;
};

function fromAddress(): string {
  const addr = process.env.SENDGRID_FROM_EMAIL ?? "hello@nyumbasearch.com";
  const name = process.env.EMAIL_FROM_NAME ?? "NyumbaSearch";
  return `${name} <${addr}>`;
}

async function logEmailAttempt(
  payload: EmailPayload,
  status: "sent" | "failed",
  providerId?: string,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("email_log").insert({
      to_email: payload.to,
      template_id: payload.templateId ?? "unknown",
      subject: payload.subject,
      status,
      provider_id: providerId ?? null,
      metadata: payload.metadata ?? {},
    });
  } catch (err) {
    console.warn("[email] Could not write email_log:", err);
  }
}

/** Sends email via SendGrid when configured; logs every attempt to email_log. */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key || !payload.to) {
    console.warn("[email] Skipped send — missing API key or recipient", payload.templateId);
    return false;
  }

  try {
    sgMail.setApiKey(key);
    const [res] = await sgMail.send({
      to: payload.to,
      from: fromAddress(),
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    const providerId = res?.headers?.["x-message-id"] as string | undefined;
    await logEmailAttempt(payload, "sent", providerId);
    return true;
  } catch (err) {
    console.error("[email] SendGrid failed:", payload.templateId, err);
    await logEmailAttempt(payload, "failed");
    return false;
  }
}
