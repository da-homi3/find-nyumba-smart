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
  const from = process.env.SENDGRID_FROM_EMAIL ?? "kevinbuluma9@gmail.com";
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

export const OPS_EMAIL = process.env.OPS_NOTIFICATION_EMAIL ?? "kevinbuluma9@gmail.com";

export async function notifyOpsNewApplication(opts: {
  applicantName: string;
  applicantEmail: string;
  role: string;
  orgName?: string;
  reviewUrl: string;
}) {
  const subject = `[NyumbaSearch] New ${opts.role} application — ${opts.applicantName}`;
  const text = `A new portal application requires your review.

Applicant: ${opts.applicantName}
Email: ${opts.applicantEmail}
Requested role: ${opts.role}
Organization: ${opts.orgName ?? "—"}

Review in admin: ${opts.reviewUrl}`;
  return sendEmailNotification({ to: OPS_EMAIL, subject, text });
}

export async function notifyApplicantApproved(opts: {
  email: string;
  name: string;
  role: string;
}) {
  if (!opts.email) return false;
  const subject = `Your NyumbaSearch ${opts.role} account is approved`;
  const text = `Hi ${opts.name},\n\nYour application to join NyumbaSearch as a ${opts.role} has been approved. Sign in and open Settings to enter your dashboard.\n\nhttps://nyumba-search.kevinbuluma1.workers.dev/auth`;
  return sendEmailNotification({ to: opts.email, subject, text });
}

export async function notifyApplicantRejected(opts: {
  email: string;
  name: string;
  role: string;
  reason?: string;
}) {
  if (!opts.email) return false;
  const subject = `NyumbaSearch ${opts.role} application update`;
  const text = `Hi ${opts.name},\n\nYour ${opts.role} application was not approved at this time.${opts.reason ? `\n\nReason: ${opts.reason}` : ""}\n\nYou can still browse listings as a tenant.`;
  return sendEmailNotification({ to: opts.email, subject, text });
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
