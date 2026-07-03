import { baseLayout } from "@/lib/email/base-layout";
import { formatKes } from "@/lib/properties";

export function paymentConfirmationEmail(opts: {
  name: string;
  productName: string;
  amountKes: number;
  method: string;
  receiptRef: string;
  date: string;
  dashboardUrl: string;
  detailHtml?: string;
}) {
  const body = `
    <h1>Payment confirmed</h1>
    <p>Hi ${opts.name},</p>
    <p>We received your payment of <strong>${formatKes(opts.amountKes)}</strong> for <strong>${opts.productName}</strong>.</p>
    <div class="highlight">
      <p style="margin:0"><strong>Method:</strong> ${opts.method}</p>
      <p style="margin:8px 0 0"><strong>Reference:</strong> ${opts.receiptRef}</p>
      <p style="margin:8px 0 0"><strong>Date:</strong> ${opts.date}</p>
    </div>
    ${opts.detailHtml ?? ""}
    <p><a class="btn" href="${opts.dashboardUrl}">View dashboard</a></p>
  `;
  return {
    subject: `Payment confirmed — ${formatKes(opts.amountKes)}`,
    html: baseLayout({ preheader: `Payment of ${formatKes(opts.amountKes)} confirmed`, body }),
    text: `Payment confirmed: ${formatKes(opts.amountKes)} for ${opts.productName}. Ref: ${opts.receiptRef}`,
  };
}

export function contactUnlockEmail(opts: {
  name: string;
  listingTitle: string;
  neighborhood: string;
  contactPhone: string;
  feeKes: number;
  method: string;
  listingUrl: string;
  plusUrl: string;
  showPlusUpsell: boolean;
}) {
  const body = `
    <h1>Contact unlocked</h1>
    <p>Hi ${opts.name},</p>
    <p>You unlocked contact details for <strong>${opts.listingTitle}</strong> in ${opts.neighborhood}.</p>
    <div class="highlight">
      <p style="margin:0;font-size:20px;font-weight:700;color:#0A5C47">${opts.contactPhone}</p>
      <p style="margin:8px 0 0">Landlord phone · ${formatKes(opts.feeKes)} via ${opts.method}</p>
    </div>
    <p><a class="btn" href="${opts.listingUrl}">View listing</a></p>
    ${
      opts.showPlusUpsell
        ? `<p style="font-size:14px">You've spent a lot on unlocks this month. <a href="${opts.plusUrl}">NyumbaSearch Plus</a> gives unlimited unlocks for less.</p>`
        : ""
    }
  `;
  return {
    subject: `Contact unlocked — ${opts.listingTitle}`,
    html: baseLayout({ preheader: `Phone: ${opts.contactPhone}`, body }),
    text: `Contact unlocked for ${opts.listingTitle}. Phone: ${opts.contactPhone}`,
  };
}

export function subscriptionActivatedEmail(opts: {
  name: string;
  planName: string;
  features: string[];
  trialEndDate?: string;
  billingUrl: string;
}) {
  const features = opts.features.map((f) => `<li>${f}</li>`).join("");
  const body = `
    <h1>Your ${opts.planName} plan is active</h1>
    <p>Hi ${opts.name},</p>
    <p>Welcome aboard — here's what's included:</p>
    <ul>${features}</ul>
    ${
      opts.trialEndDate
        ? `<p>Your free trial ends on <strong>${opts.trialEndDate}</strong>. Billing starts automatically unless you cancel.</p>`
        : ""
    }
    <p><a class="btn" href="${opts.billingUrl}">Manage subscription</a></p>
  `;
  return {
    subject: `Your ${opts.planName} subscription is active`,
    html: baseLayout({ preheader: `${opts.planName} is now active`, body }),
    text: `Your ${opts.planName} subscription is active.`,
  };
}

export function boostActivatedEmail(opts: {
  name: string;
  listingTitle: string;
  packageName: string;
  expiresAt: string;
  analyticsUrl: string;
}) {
  const body = `
    <h1>Listing boost is live</h1>
    <p>Hi ${opts.name},</p>
    <p><strong>${opts.listingTitle}</strong> is now boosted with <strong>${opts.packageName}</strong>.</p>
    <p>Active until ${opts.expiresAt}. Boosted listings appear higher in search results.</p>
    <p><a class="btn" href="${opts.analyticsUrl}">View performance</a></p>
  `;
  return {
    subject: `Boost live — ${opts.listingTitle}`,
    html: baseLayout({ preheader: `${opts.packageName} boost activated`, body }),
    text: `Boost activated for ${opts.listingTitle} until ${opts.expiresAt}.`,
  };
}

export function verificationCompleteEmail(opts: {
  name: string;
  propertyAddress: string;
  passed: boolean;
  findings?: string;
  statusUrl: string;
}) {
  const findingsBlock = opts.findings
    ? `<div class="highlight"><p style="margin:0">${opts.findings}</p></div>`
    : "";
  const body = opts.passed
    ? `
    <h1>Verification complete ✓</h1>
    <p>Hi ${opts.name},</p>
    <p>Your property at <strong>${opts.propertyAddress}</strong> passed NyumbaSearch verification.</p>
    ${findingsBlock}
    <p><a class="btn" href="${opts.statusUrl}">View full report</a></p>
  `
    : `
    <h1>Verification update</h1>
    <p>Hi ${opts.name},</p>
    <p>We completed verification for <strong>${opts.propertyAddress}</strong>. Unfortunately it did not pass at this time.</p>
    ${findingsBlock}
    <p><a class="btn btn-outline" href="${opts.statusUrl}">View details</a></p>
  `;
  return {
    subject: opts.passed
      ? "Your property verification passed"
      : "Verification results — action needed",
    html: baseLayout({
      preheader: opts.passed ? "Verification passed" : "Verification did not pass",
      body,
    }),
    text: opts.passed
      ? `Verification passed for ${opts.propertyAddress}. ${opts.statusUrl}`
      : `Verification did not pass for ${opts.propertyAddress}. ${opts.statusUrl}`,
  };
}

export function verificationSubmittedEmail(opts: {
  name: string;
  tierLabel: string;
  requestId: string;
  statusUrl: string;
}) {
  const body = `
    <h1>Verification request received</h1>
    <p>Hi ${opts.name},</p>
    <p>We received your <strong>${opts.tierLabel}</strong> verification request (ID: ${opts.requestId.slice(0, 8)}).</p>
    <p>Our team will review the property and contact you with results.</p>
    <p><a class="btn" href="${opts.statusUrl}">Track status</a></p>
  `;
  return {
    subject: "Verification request received",
    html: baseLayout({ preheader: "We'll be in touch soon", body }),
    text: `Verification request ${opts.requestId} received.`,
  };
}

export function newLeadEmail(opts: {
  landlordName: string;
  tenantFirstName: string;
  listingTitle: string;
  neighborhood: string;
  timestamp: string;
  leadsUrl: string;
}) {
  const body = `
    <h1>Someone unlocked your contact</h1>
    <p>Hi ${opts.landlordName},</p>
    <p><strong>${opts.tenantFirstName}</strong> unlocked contact details for <strong>${opts.listingTitle}</strong> in ${opts.neighborhood}.</p>
    <p style="font-size:13px;color:#64748b">${opts.timestamp}</p>
    <p><a class="btn" href="${opts.leadsUrl}">View inquiries</a></p>
  `;
  return {
    subject: `New lead — ${opts.listingTitle}`,
    html: baseLayout({ preheader: "A tenant unlocked your contact", body }),
    text: `${opts.tenantFirstName} unlocked contact for ${opts.listingTitle}.`,
  };
}

export function newMessageEmail(opts: {
  recipientName: string;
  senderName: string;
  propertyTitle: string;
  preview: string;
  threadUrl: string;
}) {
  const body = `
    <h1>New message</h1>
    <p>Hi ${opts.recipientName},</p>
    <p><strong>${opts.senderName}</strong> sent a message about <strong>${opts.propertyTitle}</strong>:</p>
    <div class="highlight"><p style="margin:0">"${opts.preview.slice(0, 200)}"</p></div>
    <p><a class="btn" href="${opts.threadUrl}">Open conversation</a></p>
  `;
  return {
    subject: `New message — ${opts.propertyTitle}`,
    html: baseLayout({ preheader: opts.preview.slice(0, 80), body }),
    text: `${opts.senderName}: ${opts.preview.slice(0, 200)}\n${opts.threadUrl}`,
  };
}

export function newListingsAlertEmail(opts: {
  alertName: string;
  listings: { title: string; neighborhood: string; priceKes: number; url: string }[];
  browseUrl: string;
}) {
  const cards = opts.listings
    .slice(0, 5)
    .map(
      (l) =>
        `<p><a href="${l.url}"><strong>${l.title}</strong></a><br>${l.neighborhood} · ${formatKes(l.priceKes)}/mo</p>`,
    )
    .join("");
  const body = `
    <h1>${opts.listings.length} new listing${opts.listings.length === 1 ? "" : "s"} match your search</h1>
    <p>Alert: <strong>${opts.alertName}</strong></p>
    ${cards}
    <p><a class="btn" href="${opts.browseUrl}">See all matches</a></p>
  `;
  return {
    subject: `${opts.listings.length} new homes match "${opts.alertName}"`,
    html: baseLayout({ preheader: `${opts.listings.length} new listings`, body }),
    text: `${opts.listings.length} new listings for ${opts.alertName}. ${opts.browseUrl}`,
  };
}

export function portalApprovedEmail(opts: { name: string; role: string; dashboardUrl: string }) {
  const body = `
    <h1>Account approved</h1>
    <p>Hi ${opts.name},</p>
    <p>Your NyumbaSearch <strong>${opts.role}</strong> account is approved. You can now access your dashboard.</p>
    <p><a class="btn" href="${opts.dashboardUrl}">Go to dashboard</a></p>
  `;
  return {
    subject: "Your NyumbaSearch account is approved",
    html: baseLayout({ preheader: "Welcome aboard", body }),
    text: `Your ${opts.role} account is approved. ${opts.dashboardUrl}`,
  };
}

export function portalRejectedEmail(opts: { name: string; role: string; reason?: string }) {
  const reasonHtml = opts.reason ? `<br><br>Reason: ${opts.reason}` : "";
  const reasonText = opts.reason ? ` Reason: ${opts.reason}` : "";
  const body = `
    <h1>Application update</h1>
    <p>Hi ${opts.name},</p>
    <p>Your ${opts.role} application was not approved at this time.${reasonHtml}</p>
    <p>You can still browse listings as a tenant.</p>
  `;
  return {
    subject: `NyumbaSearch ${opts.role} application update`,
    html: baseLayout({ preheader: "Application update", body }),
    text: `Your ${opts.role} application was not approved.${reasonText}`,
  };
}

export function passwordResetEmail(opts: {
  resetLink: string;
  otpCode: string;
  expiresMinutes?: number;
}) {
  const expires = opts.expiresMinutes ?? 60;
  const body = `
    <h1>Reset your NyumbaSearch password</h1>
    <p>Use the 6-digit code below, or tap the button to open a secure reset page.</p>
    <div class="highlight" style="text-align:center">
      <p style="margin:0;font-size:13px;color:#64748b">Your reset code</p>
      <p style="margin:8px 0 0;font-size:32px;font-weight:800;letter-spacing:0.35em;color:#0A5C47">${opts.otpCode}</p>
      <p style="margin:12px 0 0;font-size:13px;color:#64748b">Expires in ${expires} minutes</p>
    </div>
    <p style="text-align:center"><a class="btn" href="${opts.resetLink}">Reset password</a></p>
    <p style="font-size:13px;color:#64748b">If you didn't request this, you can ignore this email. Your password won't change until you complete the reset.</p>
  `;
  return {
    subject: `${opts.otpCode} is your NyumbaSearch password reset code`,
    html: baseLayout({ preheader: `Reset code: ${opts.otpCode}`, body }),
    text: `Reset your NyumbaSearch password.\n\nCode: ${opts.otpCode}\n\nOr open: ${opts.resetLink}\n\nExpires in ${expires} minutes.`,
  };
}

export function adminNewApplicationEmail(opts: {
  applicantName: string;
  applicantEmail: string;
  role: string;
  orgName?: string;
  reviewUrl: string;
}) {
  const body = `
    <h1>New ${opts.role} registration</h1>
    <p><strong>${opts.applicantName}</strong> (${opts.applicantEmail}) applied as <strong>${opts.role}</strong>.</p>
    ${opts.orgName ? `<p>Organization: ${opts.orgName}</p>` : ""}
    <p><a class="btn" href="${opts.reviewUrl}">Review application</a></p>
  `;
  return {
    subject: `New ${opts.role} registration — ${opts.applicantName}`,
    html: baseLayout({ preheader: "Needs admin review", body }),
    text: `New ${opts.role} application from ${opts.applicantName}. Review: ${opts.reviewUrl}`,
  };
}
