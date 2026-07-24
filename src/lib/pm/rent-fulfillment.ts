import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { rentReceiptEmail } from "@/lib/email/templates";
import { asPmDb, type PmDb } from "@/lib/pm/access";
import { invoiceStatusAfterPayment } from "@/lib/pm/invoice-status";
import { getSiteUrl } from "@/lib/site";
import { formatKes } from "@/lib/properties";

export { rentBalanceRemaining } from "@/lib/pm/invoice-status";

type Admin = SupabaseClient<any>;

async function loadInvoiceContext(admin: PmDb, invoiceId: string) {
  const { data: invoice } = await admin
    .from("pm_rent_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return null;

  const { data: lease } = await admin
    .from("pm_leases")
    .select("id, unit_id, tenant_id")
    .eq("id", invoice.lease_id)
    .maybeSingle();
  if (!lease) return null;

  const { data: unit } = await admin
    .from("pm_units")
    .select("id, unit_label, property_id")
    .eq("id", lease.unit_id)
    .maybeSingle();
  if (!unit) return null;

  const { data: property } = await admin
    .from("pm_properties")
    .select("id, name, owner_user_id")
    .eq("id", unit.property_id)
    .maybeSingle();
  if (!property) return null;

  const { data: tenant } = await admin
    .from("pm_tenants")
    .select("id, full_name, email, phone")
    .eq("id", lease.tenant_id)
    .maybeSingle();
  if (!tenant) return null;

  return { invoice, lease, unit, property, tenant };
}

async function reconcileInvoiceFromPayments(
  db: PmDb,
  invoiceId: string,
  amountDue: number,
  lateFee: number,
): Promise<{ status: string; amountPaid: number }> {
  const { data: pays } = await db.from("pm_rent_payments").select("amount").eq("invoice_id", invoiceId);
  const amountPaid = (pays ?? []).reduce(
    (sum: number, row: { amount: number }) => sum + Number(row.amount),
    0,
  );
  const status = invoiceStatusAfterPayment(amountDue, amountPaid, lateFee);
  const { error } = await db
    .from("pm_rent_invoices")
    .update({ amount_paid: amountPaid, status })
    .eq("id", invoiceId);
  if (error) throw error;
  return { status, amountPaid };
}

export async function fulfillPmRentPayment(
  admin: Admin,
  opts: {
    invoiceId: string;
    amountKes: number;
    paymentId: string;
    userId: string;
    mpesaReceipt: string | null;
  },
): Promise<{ status: string; amountPaid: number }> {
  const db = asPmDb(admin);
  const ctx = await loadInvoiceContext(db, opts.invoiceId);
  if (!ctx) throw new Error("Rent invoice not found for fulfillment");

  const { invoice } = ctx;
  const lateFee = Number(invoice.late_fee ?? 0);
  const amountDue = Number(invoice.amount_due);

  const { data: existingPay } = await db
    .from("pm_rent_payments")
    .select("id")
    .eq("payment_id", opts.paymentId)
    .maybeSingle();
  if (existingPay) {
    // Prior insert may have succeeded while invoice update failed — always reconcile.
    return reconcileInvoiceFromPayments(db, opts.invoiceId, amountDue, lateFee);
  }

  const { error: payErr } = await db.from("pm_rent_payments").insert({
    invoice_id: opts.invoiceId,
    amount: opts.amountKes,
    method: "mpesa",
    recorded_by_user_id: opts.userId,
    payment_id: opts.paymentId,
    mpesa_receipt_number: opts.mpesaReceipt,
  });
  if (payErr) {
    // Unique race: another fulfiller inserted the same payment_id
    if (/duplicate|unique/i.test(payErr.message ?? "")) {
      return reconcileInvoiceFromPayments(db, opts.invoiceId, amountDue, lateFee);
    }
    throw payErr;
  }

  const reconciled = await reconcileInvoiceFromPayments(db, opts.invoiceId, amountDue, lateFee);

  await sendRentReceiptEmail(db, opts.invoiceId, opts.amountKes, opts.mpesaReceipt);
  await notifyLandlordOfRentPayment(db, opts.invoiceId, opts.amountKes, reconciled.status);

  return reconciled;
}

export async function sendRentReceiptEmail(
  admin: PmDb,
  invoiceId: string,
  amountKes: number,
  mpesaReceipt: string | null,
): Promise<void> {
  const ctx = await loadInvoiceContext(admin, invoiceId);
  if (!ctx?.tenant.email) return;

  const tpl = rentReceiptEmail({
    tenantName: ctx.tenant.full_name,
    propertyName: ctx.property.name,
    unitLabel: ctx.unit.unit_label,
    periodMonth: ctx.invoice.period_month,
    amountKes,
    mpesaRef: mpesaReceipt,
  });
  await sendEmail({
    to: ctx.tenant.email,
    templateId: "rent_receipt",
    ...tpl,
  });
}

export async function notifyLandlordOfRentPayment(
  admin: PmDb,
  invoiceId: string,
  amountKes: number,
  status: string,
): Promise<void> {
  const ctx = await loadInvoiceContext(admin, invoiceId);
  if (!ctx) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(ctx.property.owner_user_id);
  const email = userData.user?.email;
  if (!email) return;

  const title = status === "paid" ? "Rent paid in full" : "Partial rent payment received";
  const body = `${ctx.tenant.full_name} paid ${formatKes(amountKes)} for unit ${ctx.unit.unit_label}`;
  const link = `${getSiteUrl()}/landlord/manage/${ctx.property.id}/rent`;
  const text = `${title}\n\n${body}\n\nView: ${link}`;
  await sendEmail({
    to: email,
    templateId: "rent_payment_landlord",
    subject: `${title} — ${ctx.property.name}`,
    text,
    html: `<p><strong>${title}</strong></p><p>${body}</p><p><a href="${link}">Open rent dashboard</a></p>`,
  });
}
