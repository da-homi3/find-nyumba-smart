import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminClient, authContext } from "@/lib/api/nyumba/nyumba-shared";
import { isKenyanPhone } from "@/lib/phone";
import { asPmDb } from "@/lib/pm/access";
import { rentBalanceRemaining } from "@/lib/pm/invoice-status";
import { initiatePaymentCore } from "@/lib/payments/initiate-payment-core";

async function loadTenantInvoicesForUser(userId: string) {
  const admin = asPmDb(await adminClient());
  const { data: tenants } = await admin
    .from("pm_tenants")
    .select("id, full_name, property_id")
    .eq("tenant_user_id", userId)
    .eq("portal_status", "accepted")
    .is("deleted_at", null);

  if (!tenants?.length) return [];

  const tenantIds = tenants.map((t: { id: string }) => t.id);
  const { data: leases } = await admin
    .from("pm_leases")
    .select("id, unit_id, tenant_id, tenant_mpesa_phone")
    .in("tenant_id", tenantIds)
    .eq("status", "active");

  if (!leases?.length) return [];

  const leaseIds = leases.map((l: { id: string }) => l.id);
  const { data: invoices } = await admin
    .from("pm_rent_invoices")
    .select("*")
    .in("lease_id", leaseIds)
    .order("period_month", { ascending: false });

  const unitIds = [...new Set(leases.map((l: { unit_id: string }) => l.unit_id))];
  const { data: units } = await admin
    .from("pm_units")
    .select("id, unit_label, property_id")
    .in("id", unitIds);

  const propertyIds = [
    ...new Set((units ?? []).map((u: { property_id: string }) => u.property_id)),
  ];
  const { data: properties } = await admin
    .from("pm_properties")
    .select("id, name, neighborhood")
    .in("id", propertyIds);

  const leaseById = new Map(leases.map((l: { id: string }) => [l.id, l]));
  const unitById = new Map(
    (units ?? []).map((u: { id: string; unit_label: string; property_id: string }) => [u.id, u]),
  );
  const propertyById = new Map(
    (properties ?? []).map((p: { id: string; name: string; neighborhood: string }) => [p.id, p]),
  );
  const tenantById = new Map(tenants.map((t: { id: string }) => [t.id, t]));

  return (invoices ?? []).map((inv: Record<string, unknown>) => {
    const lease = leaseById.get(inv.lease_id as string) as
      | { unit_id: string; tenant_id: string; tenant_mpesa_phone: string | null }
      | undefined;
    const unit = lease ? unitById.get(lease.unit_id) : undefined;
    const property = unit ? propertyById.get(unit.property_id) : undefined;
    const tenant = lease ? tenantById.get(lease.tenant_id) : undefined;
    const amountDue = Number(inv.amount_due);
    const amountPaid = Number(inv.amount_paid);
    const lateFee = Number(inv.late_fee ?? 0);
    return {
      id: inv.id as string,
      period_month: inv.period_month as string,
      due_date: inv.due_date as string,
      status: inv.status as string,
      amount_due: amountDue,
      amount_paid: amountPaid,
      late_fee: lateFee,
      balance_remaining: rentBalanceRemaining(amountDue, amountPaid, lateFee),
      unit_label: unit?.unit_label ?? null,
      property_name: property?.name ?? null,
      neighborhood: property?.neighborhood ?? null,
      tenant_name: (tenant as { full_name?: string } | undefined)?.full_name ?? null,
      default_mpesa_phone: lease?.tenant_mpesa_phone ?? null,
    };
  });
}

export const listTenantPmInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = authContext(context);
    return loadTenantInvoicesForUser(userId);
  });

export const payPmRent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      invoiceId: z.string().uuid(),
      phone: z.string().refine((p) => isKenyanPhone(p), "Invalid Safaricom phone number"),
      idempotencyKey: z.string().min(8).max(64).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = authContext(context);
    const admin = asPmDb(await adminClient());

    const { data: invoice } = await admin
      .from("pm_rent_invoices")
      .select("*")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (!invoice) throw new Error("Invoice not found");

    const { data: lease } = await admin
      .from("pm_leases")
      .select("id, tenant_id")
      .eq("id", invoice.lease_id)
      .maybeSingle();
    if (!lease) throw new Error("Lease not found");

    const { data: tenant } = await admin
      .from("pm_tenants")
      .select("id, tenant_user_id, portal_status")
      .eq("id", lease.tenant_id)
      .eq("tenant_user_id", userId)
      .eq("portal_status", "accepted")
      .is("deleted_at", null)
      .maybeSingle();
    if (!tenant) throw new Error("Not authorised for this invoice");

    if (invoice.status === "paid") {
      throw new Error("This invoice is already fully paid");
    }

    const balance = rentBalanceRemaining(
      Number(invoice.amount_due),
      Number(invoice.amount_paid),
      Number(invoice.late_fee ?? 0),
    );
    if (balance <= 0) throw new Error("Nothing left to pay on this invoice");

    await admin
      .from("pm_leases")
      .update({ tenant_mpesa_phone: data.phone })
      .eq("id", lease.id);

    const idempotencyKey =
      data.idempotencyKey ?? `rent-${data.invoiceId}-${userId.slice(0, 8)}-${Date.now()}`;

    const paymentRes = await initiatePaymentCore(userId, {
      amountKes: balance,
      paymentType: "rent_payment",
      phoneNumber: data.phone,
      paymentMethod: "mpesa",
      idempotencyKey,
      invoiceId: data.invoiceId,
      plan: data.invoiceId,
      successPath: "/tenant/rent",
      cancelPath: "/tenant/rent",
      title: `Rent ${invoice.period_month}`,
    });

    return {
      paymentId: paymentRes.paymentId,
      status: paymentRes.status,
      amount: balance,
      message: "message" in paymentRes ? paymentRes.message : undefined,
    };
  });
