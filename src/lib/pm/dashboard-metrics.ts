import type { PmDb } from "@/lib/pm/access";

export async function sumRentForPeriod(
  admin: PmDb,
  leaseIds: string[],
  periodMonth: string,
): Promise<{ expectedIncome: number; collectedThisMonth: number; outstandingRent: number }> {
  let expectedIncome = 0;
  let collectedThisMonth = 0;
  let outstandingRent = 0;
  if (leaseIds.length === 0) {
    return { expectedIncome, collectedThisMonth, outstandingRent };
  }

  const { data: invoices } = await admin
    .from("pm_rent_invoices")
    .select("amount_due, amount_paid, late_fee, status")
    .in("lease_id", leaseIds)
    .eq("period_month", periodMonth);

  for (const inv of invoices ?? []) {
    const due = inv.amount_due as number;
    const paid = inv.amount_paid as number;
    const late = Number(inv.late_fee ?? 0);
    expectedIncome += due;
    collectedThisMonth += paid;
    if (inv.status !== "paid") {
      outstandingRent += Math.max(0, due + late - paid);
    }
  }
  return { expectedIncome, collectedThisMonth, outstandingRent };
}

export async function avgClosedMaintenanceDays(
  admin: PmDb,
  unitIds: string[],
): Promise<number | null> {
  if (unitIds.length === 0) return null;
  const { data: closedMaint } = await admin
    .from("pm_maintenance_requests")
    .select("created_at, completed_at")
    .in("unit_id", unitIds)
    .in("status", ["completed", "confirmed"])
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(40);

  if (!closedMaint?.length) return null;

  let sumDays = 0;
  let n = 0;
  for (const row of closedMaint) {
    const start = Date.parse(String(row.created_at));
    const end = Date.parse(String(row.completed_at));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    sumDays += (end - start) / (1000 * 60 * 60 * 24);
    n += 1;
  }
  return n > 0 ? Math.round((sumDays / n) * 10) / 10 : null;
}

export async function leasesEndingSoon(
  admin: PmDb,
  leases: Array<{ end_date: string; tenant_id: string; unit_id: string }>,
  todayIso: string,
  in30Iso: string,
): Promise<Array<{ end_date: string; full_name: string; unit_label: string }>> {
  const ending = leases.filter((l) => l.end_date >= todayIso && l.end_date <= in30Iso);
  if (ending.length === 0) return [];

  const tenantIds = ending.map((l) => l.tenant_id);
  const { data: tenants } = await admin
    .from("pm_tenants")
    .select("id, full_name")
    .in("id", tenantIds);
  const { data: unitRows } = await admin
    .from("pm_units")
    .select("id, unit_label")
    .in(
      "id",
      ending.map((l) => l.unit_id),
    );
  const tenantName = new Map(
    (tenants ?? []).map((t: { id: string; full_name: string }) => [t.id, t.full_name]),
  );
  const unitLabel = new Map(
    (unitRows ?? []).map((u: { id: string; unit_label: string }) => [u.id, u.unit_label]),
  );
  return ending
    .map((l) => ({
      end_date: l.end_date,
      full_name: tenantName.get(l.tenant_id) ?? "Tenant",
      unit_label: unitLabel.get(l.unit_id) ?? "",
    }))
    .sort((a, b) => a.end_date.localeCompare(b.end_date));
}
