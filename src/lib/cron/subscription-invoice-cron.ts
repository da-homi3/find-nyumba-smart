import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendEmailResult } from "@/lib/email/send";
import { getEmailPrefs } from "@/lib/email/prefs";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";
import { subscriptionInvoiceEmail } from "@/lib/email/templates";
import { demandHeadline } from "@/lib/revenue/subscription-invoice";
import type { InvoiceDraft } from "@/lib/revenue/subscription-invoice";
import {
  buildOwnerInvoice,
  buildProviderInvoice,
  upsertSubscriptionInvoice,
} from "@/lib/revenue/subscription-invoice-store";

type Admin = SupabaseClient<Database>;

const OWNER_LIMIT = 25;
const PROVIDER_LIMIT = 25;

async function alreadySent(admin: Admin, userId: string, templateId: string): Promise<boolean> {
  const { data } = await admin
    .from("marketing_email_log")
    .select("id")
    .eq("user_id", userId)
    .eq("template_id", templateId)
    .maybeSingle();
  return Boolean(data);
}

async function markSent(admin: Admin, userId: string, templateId: string) {
  await admin
    .from("marketing_email_log")
    .upsert({ user_id: userId, template_id: templateId }, { onConflict: "user_id,template_id" });
}

async function userEmail(admin: Admin, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  const email = data.user?.email;
  if (!email) return null;
  const name = (data.user?.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
  return { email, name };
}

function periodLabel(draft: InvoiceDraft): string {
  const start = new Date(`${draft.periodStart}T00:00:00Z`);
  return start.toLocaleString("en-KE", { month: "long", year: "numeric", timeZone: "UTC" });
}

function howToPay(draft: InvoiceDraft): string[] {
  if (draft.audience === "provider") {
    return [
      "Open the Pay now link (sign in if asked).",
      "Confirm Basic, Featured, or Premium.",
      "Enter your M-Pesa number or choose card.",
      "Approve the STK prompt on your phone. Your profile goes live after payment (and admin approval if still pending).",
    ];
  }
  return [
    "Open the Pay now link (sign in if asked).",
    "Confirm the plan on checkout.",
    "Pay with M-Pesa STK or card.",
    "Approve the prompt on your phone. Your listings can then go public.",
  ];
}

function demandDetail(draft: InvoiceDraft): string {
  const area = draft.demand.areas[0] ?? "Nairobi";
  if (draft.audience === "provider") {
    const trade = draft.demand.categories[0] ?? "your trade";
    return `Those searches and inquiries never reach you while the ${draft.planName} subscription is unpaid. Pay now so tenants looking for ${trade} in ${area} can contact you.`;
  }
  return `They are looking in ${area}. Unpaid accounts cannot publish listings, so those tenants never see your homes or your phone number.`;
}

function emailKind(now = new Date()): "issue" | "nudge" {
  return now.getUTCDate() >= 8 ? "nudge" : "issue";
}

async function sendInvoiceEmail(admin: Admin, draft: InvoiceDraft): Promise<boolean> {
  const prefs = await getEmailPrefs(admin, draft.userId);
  if (!prefs.transactional) return false;
  const issueId = `sub_invoice-${draft.audience}-${draft.monthKey}`;
  const nudgeId = `sub_invoice-nudge-${draft.audience}-${draft.monthKey}`;
  const issueSent = await alreadySent(admin, draft.userId, issueId);
  const tplId = issueSent && emailKind() === "nudge" ? nudgeId : issueId;
  if (await alreadySent(admin, draft.userId, tplId)) return false;

  const ctx = await userEmail(admin, draft.userId);
  if (!ctx) return false;

  const includeDemand = prefs.marketing;
  const unsub = prefs.marketing ? await unsubscribeUrl(draft.userId) : undefined;
  const headline = demandHeadline(draft.demand, draft.audience);
  const tpl = subscriptionInvoiceEmail({
    name: ctx.name,
    invoiceNumber: draft.invoiceNumber,
    planName: draft.planName,
    amountKes: draft.amountKes,
    periodLabel: periodLabel(draft),
    dueLabel: draft.periodEnd,
    payUrl: draft.payUrl,
    demandHeadline: headline,
    demandDetail: demandDetail(draft),
    benefits: draft.benefits,
    howToPay: howToPay(draft),
    includeDemand,
    unsubscribeUrl: unsub,
  });
  const sent = await sendEmailResult({
    to: ctx.email,
    templateId: tplId,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
    metadata: {
      userId: draft.userId,
      invoiceNumber: draft.invoiceNumber,
      audience: draft.audience,
    },
  });
  if (!sent.ok) return false;
  await markSent(admin, draft.userId, tplId);
  return true;
}

async function processDraft(admin: Admin, draft: InvoiceDraft): Promise<boolean> {
  await upsertSubscriptionInvoice(admin, draft);
  return sendInvoiceEmail(admin, draft);
}

export async function runOwnerSubscriptionInvoiceCron(admin: Admin) {
  const stats = { invoices: 0, emailed: 0 };
  const { data: roles } = await admin
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["landlord", "manager", "agency"])
    .limit(400);

  const seen = new Set<string>();
  for (const row of roles ?? []) {
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    const draft = await buildOwnerInvoice(admin, row.user_id);
    if (!draft) continue;
    stats.invoices += 1;
    if (await processDraft(admin, draft)) stats.emailed += 1;
    if (stats.emailed >= OWNER_LIMIT) break;
  }
  return stats;
}

export async function runProviderSubscriptionInvoiceCron(admin: Admin) {
  const stats = { invoices: 0, emailed: 0 };
  const { data: providers } = await admin
    .from("service_providers")
    .select("id, user_id, tier, categories, areas_served, status")
    .not("user_id", "is", null)
    .limit(250);

  for (const row of providers ?? []) {
    if (!row.user_id) continue;
    const draft = await buildProviderInvoice(admin, row.user_id, {
      id: row.id,
      tier: row.tier,
      categories: row.categories,
      areas_served: row.areas_served,
    });
    if (!draft) continue;
    stats.invoices += 1;
    if (await processDraft(admin, draft)) stats.emailed += 1;
    if (stats.emailed >= PROVIDER_LIMIT) break;
  }
  return stats;
}

export async function runSubscriptionInvoiceCron(admin: Admin) {
  const [owners, providers] = await Promise.all([
    runOwnerSubscriptionInvoiceCron(admin).catch((e) => {
      console.warn("[invoices] owners:", e);
      return { invoices: 0, emailed: 0 };
    }),
    runProviderSubscriptionInvoiceCron(admin).catch((e) => {
      console.warn("[invoices] providers:", e);
      return { invoices: 0, emailed: 0 };
    }),
  ]);
  return { owners, providers };
}
