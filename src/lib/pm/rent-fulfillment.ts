import type { LooseDb } from "@/lib/db/loose-client";
import { sendEmailResult } from "@/lib/email/send";
import { rentReceiptEmail } from "@/lib/email/templates";
import { asPmDb, type PmDb } from "@/lib/pm/access";
import { recordFeeAndDisburse } from "@/lib/pm/fee-and-payout";
import { recomputeInvoiceStatus } from "@/lib/pm/invoice-integrity";
import { hashMpesaSmsContent } from "@/lib/pm/sms-claim-amount";
import { getSiteUrl } from "@/lib/site";
import { formatKes } from "@/lib/properties";

export { rentBalanceRemaining } from "@/lib/pm/invoice-status";

type Admin = LooseDb;

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
    .select("id, full_name, email, phone, tenant_user_id")
    .eq("id", lease.tenant_id)
    .maybeSingle();
  if (!tenant) return null;

  return { invoice, lease, unit, property, tenant };
}

async function reconcileInvoiceFromPayments(
  db: PmDb,
  invoiceId: string,
): Promise<{ status: string; amountPaid: number }> {
  return recomputeInvoiceStatus(db, invoiceId);
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

  const { data: existingPay } = await db
    .from("pm_rent_payments")
    .select("id")
    .eq("payment_id", opts.paymentId)
    .maybeSingle();
  if (existingPay) {
    // Prior insert may have succeeded while invoice update failed — always reconcile.
    return reconcileInvoiceFromPayments(db, opts.invoiceId);
  }

  const { data: payRow, error: payErr } = await db
    .from("pm_rent_payments")
    .insert({
      invoice_id: opts.invoiceId,
      amount: opts.amountKes,
      method: "mpesa",
      recorded_by_user_id: opts.userId,
      payment_id: opts.paymentId,
      mpesa_receipt_number: opts.mpesaReceipt,
    })
    .select("id")
    .single();
  if (payErr) {
    // Unique race: another fulfiller inserted the same payment_id
    if (/duplicate|unique/i.test(payErr.message ?? "")) {
      return reconcileInvoiceFromPayments(db, opts.invoiceId);
    }
    throw payErr;
  }

  await recordFeeAndDisburse(db, {
    rentPaymentId: payRow.id,
    ownerUserId: ctx.property.owner_user_id,
    propertyId: ctx.property.id,
    grossAmount: opts.amountKes,
  });

  const reconciled = await reconcileInvoiceFromPayments(db, opts.invoiceId);

  await dispatchRentReceipts(db, {
    invoiceId: opts.invoiceId,
    amountKes: opts.amountKes,
    mpesaReceipt: opts.mpesaReceipt,
    paymentRowId: payRow.id as string,
    amountPaidCumulative: reconciled.amountPaid,
    status: reconciled.status,
  });

  if (reconciled.status === "paid" && ctx.tenant.tenant_user_id) {
    const { onRentInvoicePaid } = await import("@/lib/trust/hooks");
    const wasOverdue = String(invoice.status) === "overdue";
    await onRentInvoicePaid(admin, {
      tenantUserId: ctx.tenant.tenant_user_id,
      invoiceId: opts.invoiceId,
      dueDate: String(invoice.due_date),
      wasOverdue,
      lateFee,
    });
  }

  return reconciled;
}

/**
 * Auto-record a rent payment from a pasted Safaricom M-Pesa confirmation SMS.
 * Dedupes on mpesa_receipt_number and normalized SMS content hash (fraud).
 */
export async function fulfillPmRentFromSms(
  admin: Admin,
  opts: {
    invoiceId: string;
    amountKes: number;
    userId: string;
    mpesaReceipt: string;
    paidAt: Date | null;
    rawSms: string;
  },
): Promise<{ status: string; amountPaid: number; paymentId: string }> {
  const db = asPmDb(admin);
  const ctx = await loadInvoiceContext(db, opts.invoiceId);
  if (!ctx) throw new Error("Rent invoice not found for SMS payment");

  const receipt = opts.mpesaReceipt.trim().toUpperCase();
  const smsContentHash = await hashMpesaSmsContent(opts.rawSms);

  const { data: existingReceipt } = await db
    .from("pm_rent_payments")
    .select("id, invoice_id")
    .eq("mpesa_receipt_number", receipt)
    .maybeSingle();
  if (existingReceipt) {
    throw new Error("This M-Pesa receipt was already recorded");
  }

  const { data: existingSms } = await db
    .from("pm_rent_payments")
    .select("id")
    .eq("sms_content_hash", smsContentHash)
    .maybeSingle();
  if (existingSms) {
    throw new Error("This payment message was already pasted and cannot be reused");
  }

  const paidAtIso = opts.paidAt?.toISOString() ?? new Date().toISOString();
  const note = `M-Pesa SMS auto-record\nReceipt ${receipt}\n\n${opts.rawSms.slice(0, 800)}`;

  const { data: payRow, error: payErr } = await db
    .from("pm_rent_payments")
    .insert({
      invoice_id: opts.invoiceId,
      amount: opts.amountKes,
      method: "mpesa_sms",
      recorded_by_user_id: opts.userId,
      mpesa_receipt_number: receipt,
      paid_at: paidAtIso,
      note,
      sms_content_hash: smsContentHash,
    })
    .select("id")
    .single();
  if (payErr) {
    if (/duplicate|unique|sms_content_hash/i.test(payErr.message ?? "")) {
      throw new Error(
        /sms_content_hash/i.test(payErr.message ?? "")
          ? "This payment message was already pasted and cannot be reused"
          : "This M-Pesa receipt was already recorded",
      );
    }
    throw payErr;
  }

  await recordFeeAndDisburse(db, {
    rentPaymentId: payRow.id,
    ownerUserId: ctx.property.owner_user_id,
    propertyId: ctx.property.id,
    grossAmount: opts.amountKes,
  });

  const reconciled = await reconcileInvoiceFromPayments(db, opts.invoiceId);
  await dispatchRentReceipts(db, {
    invoiceId: opts.invoiceId,
    amountKes: opts.amountKes,
    mpesaReceipt: receipt,
    paymentRowId: payRow.id as string,
    amountPaidCumulative: reconciled.amountPaid,
    status: reconciled.status,
  });

  if (reconciled.status === "paid" && ctx.tenant.tenant_user_id) {
    const { onRentInvoicePaid } = await import("@/lib/trust/hooks");
    const wasOverdue = String(ctx.invoice.status) === "overdue";
    await onRentInvoicePaid(admin, {
      tenantUserId: ctx.tenant.tenant_user_id,
      invoiceId: opts.invoiceId,
      dueDate: String(ctx.invoice.due_date),
      wasOverdue,
      lateFee: Number(ctx.invoice.late_fee ?? 0),
    });
  }

  return { ...reconciled, paymentId: payRow.id as string };
}

export async function dispatchRentReceipts(
  admin: PmDb,
  opts: {
    invoiceId: string;
    amountKes: number;
    mpesaReceipt: string | null;
    paymentRowId: string;
    amountPaidCumulative: number;
    status: string;
  },
): Promise<void> {
  const ctx = await loadInvoiceContext(admin, opts.invoiceId);
  if (!ctx) return;

  const amountDue = Number(ctx.invoice.amount_due) + Number(ctx.invoice.late_fee ?? 0);
  const balanceRemaining = Math.max(0, amountDue - opts.amountPaidCumulative);
  const { nyumbaRentReceiptNo } = await import("@/lib/pm/rent-receipt");
  const nyumbaReceiptNo = nyumbaRentReceiptNo(opts.paymentRowId);
  const paidAtIso = new Date().toISOString();
  const shared = {
    tenantName: ctx.tenant.full_name,
    propertyName: ctx.property.name,
    unitLabel: ctx.unit.unit_label,
    periodMonth: String(ctx.invoice.period_month),
    amountKes: opts.amountKes,
    amountDue,
    amountPaidCumulative: opts.amountPaidCumulative,
    balanceRemaining,
    status: opts.status,
    mpesaRef: opts.mpesaReceipt,
    nyumbaReceiptNo,
    paidAtIso,
  };

  const receiptTag = `NyumbaSearch receipt ${nyumbaReceiptNo}`;
  try {
    const { data: pay } = await admin
      .from("pm_rent_payments")
      .select("note")
      .eq("id", opts.paymentRowId)
      .maybeSingle();
    const prev = typeof pay?.note === "string" ? pay.note : "";
    if (!prev.includes(nyumbaReceiptNo)) {
      await admin
        .from("pm_rent_payments")
        .update({ note: prev ? `${receiptTag}\n${prev}` : receiptTag })
        .eq("id", opts.paymentRowId);
    }
  } catch {
    // non-fatal
  }

  let tenantEmail = (ctx.tenant.email as string | null)?.trim() || null;
  if (!tenantEmail && ctx.tenant.tenant_user_id) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
        ctx.tenant.tenant_user_id as string,
      );
      tenantEmail = userData.user?.email ?? null;
    } catch {
      // ignore
    }
  }

  if (tenantEmail) {
    const tpl = rentReceiptEmail({
      ...shared,
      recipientRole: "tenant",
      dashboardUrl: `${getSiteUrl()}/tenant/rent`,
    });
    await sendEmailResult({
      to: tenantEmail,
      templateId: "rent_receipt",
      metadata: {
        invoiceId: opts.invoiceId,
        nyumbaReceiptNo,
        balanceRemaining,
      },
      ...tpl,
    });
  } else {
    console.warn("[pm] rent receipt skipped — tenant has no email", opts.invoiceId);
  }

  if (ctx.tenant.tenant_user_id) {
    const { notifyUser } = await import("@/lib/notifications/notify-user");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await notifyUser(supabaseAdmin, {
      userId: ctx.tenant.tenant_user_id as string,
      type: "rent",
      title: "NyumbaSearch rent receipt",
      body: `${formatKes(opts.amountKes)} paid · balance ${formatKes(balanceRemaining)} · ${nyumbaReceiptNo}`,
      href: "/tenant/rent",
      entityType: "rent_invoice",
      entityId: opts.invoiceId,
    });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(
    ctx.property.owner_user_id,
  );
  const ownerEmail = ownerData.user?.email;
  const title = opts.status === "paid" ? "Rent paid in full" : "Partial rent payment received";
  const link = `${getSiteUrl()}/landlord/manage/${ctx.property.id}/rent`;

  if (ownerEmail) {
    const tpl = rentReceiptEmail({
      ...shared,
      recipientRole: "landlord",
      dashboardUrl: link,
    });
    await sendEmailResult({
      to: ownerEmail,
      templateId: "rent_payment_landlord",
      metadata: {
        invoiceId: opts.invoiceId,
        nyumbaReceiptNo,
        balanceRemaining,
      },
      ...tpl,
      subject: `${title} — ${formatKes(opts.amountKes)} — ${ctx.property.name}`,
    });
  }

  const { notifyUser } = await import("@/lib/notifications/notify-user");
  await notifyUser(supabaseAdmin, {
    userId: ctx.property.owner_user_id,
    type: "rent",
    title,
    body: `${ctx.tenant.full_name} paid ${formatKes(opts.amountKes)} · balance ${formatKes(balanceRemaining)} · ${nyumbaReceiptNo}`,
    href: `/landlord/manage/${ctx.property.id}/rent`,
    entityType: "rent_invoice",
    entityId: opts.invoiceId,
  });
}
