import type { PmDb } from "@/lib/pm/access";

/** Seed / upsert the current calendar-month invoice for one active lease. */
export async function seedCurrentPeriodInvoiceForLease(
  admin: PmDb,
  lease: { id: string; monthly_rent: number },
): Promise<void> {
  const today = new Date();
  const periodMonth = today.toISOString().slice(0, 7);
  const due = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 5));
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  if (due < todayUtc) {
    due.setUTCMonth(due.getUTCMonth() + 1);
    due.setUTCDate(5);
  }

  const { error } = await admin.from("pm_rent_invoices").upsert(
    {
      lease_id: lease.id,
      period_month: periodMonth,
      amount_due: lease.monthly_rent,
      due_date: due.toISOString().slice(0, 10),
      status: "pending",
    },
    { onConflict: "lease_id,period_month", ignoreDuplicates: true },
  );
  if (error && !/duplicate|unique/i.test(error.message ?? "")) {
    throw error;
  }
}

/** Ensure every active lease for these tenant ids has a current-period invoice. */
export async function seedInvoicesForTenantIds(admin: PmDb, tenantIds: string[]): Promise<number> {
  if (tenantIds.length === 0) return 0;
  const { data: leases, error } = await admin
    .from("pm_leases")
    .select("id, monthly_rent, start_date, end_date")
    .in("tenant_id", tenantIds)
    .eq("status", "active");
  if (error) throw error;

  const todayIso = new Date().toISOString().slice(0, 10);
  let seeded = 0;
  for (const lease of leases ?? []) {
    // Skip leases that haven't started or already ended (still allow if dates missing).
    if (lease.start_date && lease.start_date > todayIso) continue;
    if (lease.end_date && lease.end_date < todayIso) continue;
    await seedCurrentPeriodInvoiceForLease(admin, lease);
    seeded += 1;
  }
  return seeded;
}
