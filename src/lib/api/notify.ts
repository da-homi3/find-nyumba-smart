import sgMail from "@sendgrid/mail";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/** Sends email via SendGrid when SENDGRID_API_KEY is configured; otherwise no-op. */
export async function sendEmailNotification(payload: EmailPayload): Promise<boolean> {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL ?? "noreply@nyumbasearch.co.ke";
  if (!key || !payload.to) return false;

  try {
    sgMail.setApiKey(key);
    await sgMail.send({
      to: payload.to,
      from,
      subject: payload.subject,
      text: payload.text,
      html: payload.html ?? payload.text.replace(/\n/g, "<br>"),
    });
    return true;
  } catch (err) {
    console.error("SendGrid notification failed:", err);
    return false;
  }
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
  const subject = `New message about ${opts.propertyTitle} — NyumbaSearch`;
  const text = `Hi ${opts.recipientName},\n\n${opts.senderName} sent you a message about "${opts.propertyTitle}":\n\n"${opts.preview.slice(0, 200)}"\n\nOpen the conversation: ${opts.threadUrl}`;
  return sendEmailNotification({ to: opts.recipientEmail, subject, text });
}
