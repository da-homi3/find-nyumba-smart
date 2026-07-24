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
    <h1>Verification complete</h1>
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

export function orgTeamInviteEmail(opts: {
  inviteeName: string;
  inviterName: string;
  organizationName: string;
  portalLabel: string;
  signInUrl: string;
  isNewAccount: boolean;
  setupPasswordUrl?: string;
  otpCode?: string;
}) {
  const setupBlock =
    opts.isNewAccount && opts.setupPasswordUrl && opts.otpCode
      ? `
    <div class="highlight" style="text-align:center">
      <p style="margin:0;font-size:13px;color:#64748b">Set your password — use this code</p>
      <p style="margin:8px 0 0;font-size:32px;font-weight:800;letter-spacing:0.35em;color:#0A5C47">${opts.otpCode}</p>
      <p style="margin:12px 0 0;font-size:13px;color:#64748b">Expires in 60 minutes</p>
    </div>
    <p style="text-align:center"><a class="btn" href="${opts.setupPasswordUrl}">Set your password</a></p>
  `
      : "";

  const body = `
    <h1>You&apos;re invited to ${opts.organizationName}</h1>
    <p>Hi ${opts.inviteeName},</p>
    <p><strong>${opts.inviterName}</strong> invited you to join <strong>${opts.organizationName}</strong> on NyumbaSearch as a ${opts.portalLabel} team member.</p>
    ${setupBlock}
    <p>After ${opts.isNewAccount ? "setting your password, " : ""}sign in with <strong>${opts.signInUrl.replace(/^https?:\/\//, "")}</strong>. Your access stays pending until the owner approves you on the Team page.</p>
    <p style="text-align:center"><a class="btn" href="${opts.signInUrl}">Sign in to NyumbaSearch</a></p>
    <p style="font-size:13px;color:#64748b">If you weren&apos;t expecting this invite, you can ignore this email.</p>
  `;
  const textSetup =
    opts.isNewAccount && opts.otpCode && opts.setupPasswordUrl
      ? `\n\nSet your password with code ${opts.otpCode} or open: ${opts.setupPasswordUrl}\n`
      : "";
  return {
    subject: `You're invited to join ${opts.organizationName} on NyumbaSearch`,
    html: baseLayout({ preheader: `Team invite from ${opts.inviterName}`, body }),
    text: `${opts.inviterName} invited you to ${opts.organizationName} (${opts.portalLabel}).${textSetup}\nSign in: ${opts.signInUrl}\n\nYour access is pending owner approval.`,
  };
}

export function orgTeamApprovedEmail(opts: {
  inviteeName: string;
  organizationName: string;
  portalLabel: string;
  dashboardUrl: string;
}) {
  const body = `
    <h1>Team access approved</h1>
    <p>Hi ${opts.inviteeName},</p>
    <p>You&apos;ve been approved to join <strong>${opts.organizationName}</strong> as a ${opts.portalLabel} team member. You can now manage listings and leads.</p>
    <p><a class="btn" href="${opts.dashboardUrl}">Open dashboard</a></p>
  `;
  return {
    subject: `You're approved — ${opts.organizationName} team access`,
    html: baseLayout({ preheader: "Your team access is live", body }),
    text: `You're approved for ${opts.organizationName}. Dashboard: ${opts.dashboardUrl}`,
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

export function foundingMemberClaimedEmail(opts: {
  name: string;
  slotNumber: number;
  maxSlots: number;
  bonusListings: number;
  label: string;
}) {
  const body = `
    <div style="text-align:center;margin-bottom:20px">
      <span style="display:inline-block;background:#F6AD5522;color:#F6AD55;padding:8px 20px;border-radius:99px;font-weight:700;font-size:14px">
        FOUNDING MEMBER #${opts.slotNumber} OF ${opts.maxSlots}
      </span>
    </div>
    <h1>You're one of the first ${opts.maxSlots} — welcome aboard.</h1>
    <p>Hi ${opts.name},</p>
    <p>As one of NyumbaSearch's first ${opts.maxSlots} ${opts.label.toLowerCase()}s, you've secured:</p>
    <div class="highlight">
      <strong>30 days completely free</strong> — no charge today, as with every new account<br>
      <strong>Bonus: +${opts.bonusListings} bonus free listing slots</strong> — on top of your plan's normal allowance
    </div>
    <p><strong>One thing to know:</strong> the bonus listing slots activate automatically once your first month is billed successfully on day 31. If you don't continue past your free trial, no bonus is charged or owed — the offer simply doesn't activate, and that founding member spot passes to someone else.</p>
    <p>Start listing right away — your bonus slots will appear on day 31.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="https://nyumbasearch.com/landlord/properties/new" class="btn">Add your first listing →</a>
    </p>
  `;
  return {
    subject: `You're Founding Member #${opts.slotNumber} of ${opts.maxSlots}!`,
    html: baseLayout({
      preheader: "You've secured a Founding Member spot — here's what happens next.",
      body,
    }),
    text: `Founding Member #${opts.slotNumber} of ${opts.maxSlots}. +${opts.bonusListings} bonus listings after your first paid month.`,
  };
}

export function foundingMemberConfirmedEmail(opts: { name: string; bonusListings: number }) {
  const body = `
    <h1>Your Founding Member bonus is officially active!</h1>
    <p>Hi ${opts.name},</p>
    <p>Thanks for sticking with NyumbaSearch through your first month. As promised,
    <strong>${opts.bonusListings} bonus listing slots</strong> have been added to your account permanently — on top of your regular plan allowance.</p>
    <p><a class="btn" href="https://nyumbasearch.com/landlord/properties">View your listing dashboard →</a></p>
  `;
  return {
    subject: `Your ${opts.bonusListings} bonus listing slots are now live`,
    html: baseLayout({ preheader: "Founding Member bonus activated", body }),
    text: `${opts.bonusListings} bonus listing slots are now on your account.`,
  };
}

export function tenantPortalInviteEmail(opts: {
  tenantName: string;
  propertyName: string;
  inviteUrl: string;
  hasExistingAccount: boolean;
}) {
  const action = opts.hasExistingAccount
    ? "Sign in to accept and link your existing NyumbaSearch account."
    : "Create a free account (or sign in) to accept and manage your tenancy.";
  const body = `
    <h1>You're invited to your tenancy portal</h1>
    <p>Hi ${opts.tenantName},</p>
    <p>Your landlord invited you to manage your tenancy at <strong>${opts.propertyName}</strong> on NyumbaSearch.</p>
    <p>${action}</p>
    <p><a class="btn" href="${opts.inviteUrl}">Respond to invitation</a></p>
    <p style="font-size:13px;color:#666">This link expires in 14 days. If you decline, your landlord can still manage the lease internally.</p>
  `;
  return {
    subject: `Your landlord has invited you to manage your tenancy on NyumbaSearch`,
    html: baseLayout({
      preheader: `Invitation for ${opts.propertyName}`,
      body,
    }),
    text: `You're invited to manage your tenancy at ${opts.propertyName}. ${action} ${opts.inviteUrl}`,
  };
}

export function rentReceiptEmail(opts: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  periodMonth: string;
  amountKes: number;
  mpesaRef: string | null;
}) {
  const body = `
    <h1>Payment received</h1>
    <p>Hi ${opts.tenantName},</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748B">Property</td><td style="padding:8px 0;text-align:right;font-weight:600">${opts.propertyName}</td></tr>
      <tr><td style="padding:8px 0;color:#64748B">Unit</td><td style="padding:8px 0;text-align:right;font-weight:600">${opts.unitLabel}</td></tr>
      <tr><td style="padding:8px 0;color:#64748B">Period</td><td style="padding:8px 0;text-align:right;font-weight:600">${opts.periodMonth}</td></tr>
      <tr><td style="padding:8px 0;color:#64748B">Amount paid</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#0A5C47">${formatKes(opts.amountKes)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748B">M-Pesa Ref</td><td style="padding:8px 0;text-align:right;font-family:monospace">${opts.mpesaRef ?? "—"}</td></tr>
    </table>
    <p style="color:#8AB5A0;font-size:12px;margin-top:20px">This receipt is generated automatically by NyumbaSearch on behalf of your landlord/property manager.</p>
  `;
  return {
    subject: `Rent receipt — ${opts.periodMonth} — ${opts.propertyName}`,
    html: baseLayout({ preheader: `Rent payment ${formatKes(opts.amountKes)}`, body }),
    text: `Rent receipt for ${opts.propertyName} unit ${opts.unitLabel} (${opts.periodMonth}): ${formatKes(opts.amountKes)}. Ref: ${opts.mpesaRef ?? "—"}`,
  };
}

export function rentReminderSubject(
  type: "upcoming" | "due_today" | "overdue_3day" | "overdue_7day",
  unitLabel: string,
  balanceKes: number,
): string {
  const amount = formatKes(balanceKes);
  switch (type) {
    case "upcoming":
      return `Rent of ${amount} due in 3 days — ${unitLabel}`;
    case "due_today":
      return `Rent due today — ${amount} for ${unitLabel}`;
    case "overdue_3day":
      return `Rent overdue — please pay ${amount} for ${unitLabel}`;
    case "overdue_7day":
      return `Urgent: rent 7 days overdue for ${unitLabel}`;
    default:
      return "Rent reminder";
  }
}

export function rentReminderEmail(opts: {
  type: "upcoming" | "due_today" | "overdue_3day" | "overdue_7day";
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  balanceKes: number;
  dueDate: string;
}) {
  const payUrl = "https://nyumbasearch.com/tenant/rent";
  const body = `
    <h1>${rentReminderSubject(opts.type, opts.unitLabel, opts.balanceKes)}</h1>
    <p>Hi ${opts.tenantName},</p>
    <p>This is a reminder about rent for <strong>${opts.propertyName}</strong>, unit <strong>${opts.unitLabel}</strong>.</p>
    <div class="highlight">
      <p style="margin:0"><strong>Balance:</strong> ${formatKes(opts.balanceKes)}</p>
      <p style="margin:8px 0 0"><strong>Due date:</strong> ${opts.dueDate}</p>
    </div>
    <p><a class="btn" href="${payUrl}">Pay rent with M-Pesa</a></p>
  `;
  return {
    html: baseLayout({ preheader: `Rent reminder for ${opts.unitLabel}`, body }),
    text: `${rentReminderSubject(opts.type, opts.unitLabel, opts.balanceKes)}. Balance ${formatKes(opts.balanceKes)}. Pay: ${payUrl}`,
  };
}

