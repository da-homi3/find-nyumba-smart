import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parsePaymentMetadata } from "@/lib/payments/payment-metadata";
import {
  BOOST_PACKAGES,
  LANDLORD_PLANS,
  PLUS_PLAN,
  REPORT_CATALOG,
  VERIFICATION_TIERS,
} from "@/lib/revenue/plans";
import { getSiteUrl } from "@/lib/site";
import { sendEmail } from "@/lib/email/send";
import {
  boostActivatedEmail,
  paymentConfirmationEmail,
  subscriptionActivatedEmail,
  verificationSubmittedEmail,
} from "@/lib/email/templates";
import { notifyContactUnlockEmails } from "@/lib/email/contact-unlock-notify";

type Admin = SupabaseClient<Database>;
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

function paymentMethodLabel(method: string | null): string {
  return method === "card" ? "Card (Pesapal)" : "M-Pesa";
}

function productNameForPayment(
  payment: PaymentRow,
  meta: ReturnType<typeof parsePaymentMetadata>,
): string {
  switch (payment.payment_type) {
    case "tenant_plus":
      return "NyumbaSearch Plus";
    case "landlord_plan":
    case "premium_subscription":
      return LANDLORD_PLANS.find((p) => p.id === meta.plan)?.name ?? "Landlord plan";
    case "property_boost":
    case "featured_listing":
      return `${BOOST_PACKAGES.find((p) => p.id === meta.boostPackage)?.name ?? "Listing"} boost`;
    case "contact_unlock":
      return "Contact unlock";
    case "verification":
      return `${VERIFICATION_TIERS.find((t) => t.id === meta.verificationTier)?.name ?? "Property"} verification`;
    case "report":
      return REPORT_CATALOG.find((r) => r.id === meta.reportType)?.name ?? "Market report";
    case "lead_pack":
      return `Lead pack (${meta.qty ?? ""} leads)`;
    case "provider_subscription":
      return "Service provider listing";
    default:
      return "NyumbaSearch purchase";
  }
}

async function loadUserContext(admin: Admin, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  const user = data.user;
  if (!user?.email) return null;
  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email.split("@")[0];
  return { email: user.email, name, firstName: name.split(" ")[0] ?? name };
}

async function loadProperty(admin: Admin, propertyId: string | null) {
  if (!propertyId) return null;
  const { data } = await admin
    .from("properties")
    .select("id, title, neighborhood, contact_phone, owner_id, rent_kes")
    .eq("id", propertyId)
    .maybeSingle();
  return data;
}

async function notifyContactUnlock(
  admin: Admin,
  payment: PaymentRow,
  _user: { email: string; name: string; firstName: string },
) {
  if (!payment.property_id) return;
  await notifyContactUnlockEmails(admin, {
    userId: payment.user_id,
    listingId: payment.property_id,
    method: "paid",
    feeKes: payment.amount_kes,
    paidMethod: paymentMethodLabel(payment.payment_method),
  });
}

async function notifySubscriptionActivated(
  admin: Admin,
  payment: PaymentRow,
  user: { email: string; name: string },
  meta: ReturnType<typeof parsePaymentMetadata>,
) {
  const base = getSiteUrl();
  if (payment.payment_type === "tenant_plus") {
    const tpl = subscriptionActivatedEmail({
      name: user.name,
      planName: "NyumbaSearch Plus",
      features: PLUS_PLAN.features,
      trialEndDate: payment.trial_end
        ? new Date(payment.trial_end).toLocaleDateString("en-KE")
        : undefined,
      billingUrl: `${base}/tenant/profile`,
    });
    await sendEmail({ to: user.email, templateId: "subscription-activated", ...tpl });
    return;
  }

  if (payment.payment_type === "landlord_plan" || payment.payment_type === "premium_subscription") {
    const plan = LANDLORD_PLANS.find((p) => p.id === meta.plan) ?? LANDLORD_PLANS[1];
    const tpl = subscriptionActivatedEmail({
      name: user.name,
      planName: plan?.name ?? "Landlord plan",
      features: plan?.features ?? [],
      billingUrl: `${base}/landlord/dashboard/billing`,
    });
    await sendEmail({ to: user.email, templateId: "subscription-activated", ...tpl });
  }
}

async function notifyBoost(
  admin: Admin,
  payment: PaymentRow,
  user: { email: string; name: string },
  meta: ReturnType<typeof parsePaymentMetadata>,
) {
  const property = await loadProperty(admin, payment.property_id);
  if (!property) return;
  const pkg = BOOST_PACKAGES.find((p) => p.id === meta.boostPackage) ?? BOOST_PACKAGES[0];
  const days = pkg?.durationDays ?? 7;
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  const tpl = boostActivatedEmail({
    name: user.name,
    listingTitle: property.title,
    packageName: pkg?.name ?? "Boost",
    expiresAt: expires.toLocaleDateString("en-KE"),
    analyticsUrl: `${getSiteUrl()}/landlord/analytics`,
  });
  await sendEmail({ to: user.email, templateId: "boost-activated", ...tpl });
}

async function notifyVerification(
  admin: Admin,
  payment: PaymentRow,
  user: { email: string; name: string },
  meta: ReturnType<typeof parsePaymentMetadata>,
) {
  const tier =
    VERIFICATION_TIERS.find((t) => t.id === meta.verificationTier) ?? VERIFICATION_TIERS[1];
  const requestId = meta.verificationRequestId ?? payment.id;
  const tpl = verificationSubmittedEmail({
    name: user.name,
    tierLabel: tier?.name ?? "Standard verification",
    requestId,
    statusUrl: `${getSiteUrl()}/verify/status/${requestId}`,
  });
  await sendEmail({ to: user.email, templateId: "verification-submitted", ...tpl });
}

/** Send payment receipt and purpose-specific emails after fulfillment. */
export async function sendPaymentLifecycleEmails(admin: Admin, payment: PaymentRow): Promise<void> {
  if (payment.status !== "completed") return;

  const user = await loadUserContext(admin, payment.user_id);
  if (!user) return;

  const meta = parsePaymentMetadata(payment.metadata);
  const productName = productNameForPayment(payment, meta);
  const receiptRef = payment.mpesa_receipt ?? payment.id.slice(0, 8).toUpperCase();
  const dashboardUrl =
    payment.payment_type === "tenant_plus"
      ? `${getSiteUrl()}/tenant/profile`
      : `${getSiteUrl()}/landlord/dashboard/billing`;

  const generic = paymentConfirmationEmail({
    name: user.name,
    productName,
    amountKes: payment.amount_kes,
    method: paymentMethodLabel(payment.payment_method),
    receiptRef,
    date: new Date(payment.created_at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }),
    dashboardUrl,
  });
  await sendEmail({ to: user.email, templateId: "payment-confirmation", ...generic });

  switch (payment.payment_type) {
    case "contact_unlock":
      await notifyContactUnlock(admin, payment, user);
      break;
    case "tenant_plus":
    case "landlord_plan":
    case "premium_subscription":
    case "provider_subscription":
      await notifySubscriptionActivated(admin, payment, user, meta);
      break;
    case "property_boost":
    case "featured_listing":
      await notifyBoost(admin, payment, user, meta);
      break;
    case "verification":
      await notifyVerification(admin, payment, user, meta);
      break;
    default:
      break;
  }
}
