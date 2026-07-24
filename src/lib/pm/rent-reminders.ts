import type { PmDb } from "@/lib/pm/access";
import { calculateLateFeeKes } from "@/lib/pm/invoice-status";
import { sendEmail } from "@/lib/email/send";
import { rentReminderEmail, rentReminderSubject } from "@/lib/email/templates";
import { formatKes } from "@/lib/properties";

export type ReminderType = "upcoming" | "due_today" | "overdue_3day" | "overdue_7day";

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function applyPmLateFees(admin: PmDb): Promise<{ updated: number }> {
  const { data: overdue, error } = await admin
    .from("pm_rent_invoices")
    .select("id, amount_due, amount_paid, due_date, late_fee, lease_id")
    .eq("status", "overdue")
    .eq("late_fee", 0);

  if (error) throw error;
  if (!overdue?.length) return { updated: 0 };

  const leaseIds = [...new Set(overdue.map((i: { lease_id: string }) => i.lease_id))];
  const { data: leases } = await admin.from("pm_leases").select("id, unit_id").in("id", leaseIds);
  const leaseById = new Map((leases ?? []).map((l: { id: string; unit_id: string }) => [l.id, l]));

  const unitIds = [...new Set((leases ?? []).map((l: { unit_id: string }) => l.unit_id))];
  const { data: units } = await admin
    .from("pm_units")
    .select("id, property_id")
    .in("id", unitIds);
  const unitById = new Map(
    (units ?? []).map((u: { id: string; property_id: string }) => [u.id, u]),
  );

  const propertyIds = [...new Set((units ?? []).map((u: { property_id: string }) => u.property_id))];
  const { data: properties } = await admin
    .from("pm_properties")
    .select("id, late_fee_percent_per_week")
    .in("id", propertyIds);
  const percentByProperty = new Map(
    (properties ?? []).map((p: { id: string; late_fee_percent_per_week: number }) => [
      p.id,
      Number(p.late_fee_percent_per_week ?? 5),
    ]),
  );

  let updated = 0;
  for (const inv of overdue) {
    const lease = leaseById.get(inv.lease_id);
    if (!lease) continue;
    const unit = unitById.get(lease.unit_id);
    if (!unit) continue;
    const percent = percentByProperty.get(unit.property_id) ?? 5;
    const lateFee = calculateLateFeeKes(
      Number(inv.amount_due),
      Number(inv.amount_paid),
      inv.due_date as string,
      percent,
    );
    if (lateFee <= 0) continue;

    const { error: updErr } = await admin
      .from("pm_rent_invoices")
      .update({ late_fee: lateFee })
      .eq("id", inv.id)
      .eq("late_fee", 0);
    if (!updErr) updated += 1;
  }

  return { updated };
}

type ReminderInvoice = {
  id: string;
  amount_due: number;
  amount_paid: number;
  late_fee: number;
  due_date: string;
  period_month: string;
  full_name: string;
  email: string | null;
  unit_label: string;
  property_name: string;
};

async function invoicesDueOn(admin: PmDb, dueDateIso: string): Promise<ReminderInvoice[]> {
  const { data: invoices } = await admin
    .from("pm_rent_invoices")
    .select("id, amount_due, amount_paid, late_fee, due_date, period_month, lease_id")
    .in("status", ["pending", "partial", "overdue"])
    .eq("due_date", dueDateIso);

  if (!invoices?.length) return [];

  const leaseIds = [...new Set(invoices.map((i: { lease_id: string }) => i.lease_id))];
  const { data: leases } = await admin
    .from("pm_leases")
    .select("id, unit_id, tenant_id")
    .in("id", leaseIds);
  const leaseById = new Map(
    (leases ?? []).map((l: { id: string; unit_id: string; tenant_id: string }) => [l.id, l]),
  );

  const unitIds = [...new Set((leases ?? []).map((l: { unit_id: string }) => l.unit_id))];
  const tenantIds = [...new Set((leases ?? []).map((l: { tenant_id: string }) => l.tenant_id))];

  const [{ data: units }, { data: tenants }] = await Promise.all([
    admin.from("pm_units").select("id, unit_label, property_id").in("id", unitIds),
    admin.from("pm_tenants").select("id, full_name, email").in("id", tenantIds),
  ]);
  const unitById = new Map(
    (units ?? []).map((u: { id: string; unit_label: string; property_id: string }) => [u.id, u]),
  );
  const tenantById = new Map(
    (tenants ?? []).map((t: { id: string; full_name: string; email: string | null }) => [t.id, t]),
  );

  const propertyIds = [...new Set((units ?? []).map((u: { property_id: string }) => u.property_id))];
  const { data: properties } = await admin
    .from("pm_properties")
    .select("id, name")
    .in("id", propertyIds);
  const propertyById = new Map(
    (properties ?? []).map((p: { id: string; name: string }) => [p.id, p]),
  );

  const results: ReminderInvoice[] = [];
  for (const inv of invoices) {
    const lease = leaseById.get(inv.lease_id);
    if (!lease) continue;
    const unit = unitById.get(lease.unit_id);
    const tenant = tenantById.get(lease.tenant_id);
    if (!unit || !tenant) continue;
    const property = propertyById.get(unit.property_id);

    results.push({
      id: inv.id,
      amount_due: Number(inv.amount_due),
      amount_paid: Number(inv.amount_paid),
      late_fee: Number(inv.late_fee ?? 0),
      due_date: inv.due_date,
      period_month: inv.period_month,
      full_name: tenant.full_name,
      email: tenant.email,
      unit_label: unit.unit_label,
      property_name: property?.name ?? "Property",
    });
  }
  return results;
}

export async function sendPmRentReminders(admin: PmDb): Promise<{ sent: number }> {
  const stages: Array<{ type: ReminderType; dueDate: string }> = [
    { type: "upcoming", dueDate: isoDateOffset(3) },
    { type: "due_today", dueDate: isoDateOffset(0) },
    { type: "overdue_3day", dueDate: isoDateOffset(-3) },
    { type: "overdue_7day", dueDate: isoDateOffset(-7) },
  ];

  let sent = 0;
  for (const stage of stages) {
    const invoices = await invoicesDueOn(admin, stage.dueDate);
    if (invoices.length === 0) continue;

    const ids = invoices.map((i) => i.id);
    const { data: already } = await admin
      .from("pm_rent_reminder_log")
      .select("invoice_id")
      .eq("reminder_type", stage.type)
      .in("invoice_id", ids);
    const sentIds = new Set((already ?? []).map((r: { invoice_id: string }) => r.invoice_id));

    for (const inv of invoices) {
      if (sentIds.has(inv.id)) continue;

      const balance = inv.amount_due + inv.late_fee - inv.amount_paid;
      if (inv.email) {
        const tpl = rentReminderEmail({
          type: stage.type,
          tenantName: inv.full_name,
          propertyName: inv.property_name,
          unitLabel: inv.unit_label,
          balanceKes: Math.max(0, balance),
          dueDate: inv.due_date,
        });
        await sendEmail({
          to: inv.email,
          templateId: `rent_reminder_${stage.type}`,
          subject: rentReminderSubject(stage.type, inv.unit_label, Math.max(0, balance)),
          ...tpl,
        });
      }

      const { error } = await admin.from("pm_rent_reminder_log").insert({
        invoice_id: inv.id,
        reminder_type: stage.type,
      });
      if (!error) sent += 1;
      else if (!/duplicate|unique/i.test(error.message ?? "")) {
        console.warn("[pm-reminders]", error.message);
      }
    }
  }

  return { sent };
}

/** @deprecated format helper kept for tests */
export function formatReminderBalance(amountDue: number, amountPaid: number): string {
  return formatKes(Math.max(0, amountDue - amountPaid));
}
