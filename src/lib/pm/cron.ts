import type { PmDb } from "@/lib/pm/access";

export async function generatePmMonthlyInvoices(admin: PmDb): Promise<{ created: number }> {
  const today = new Date();
  const periodMonth = today.toISOString().slice(0, 7);
  const dueDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 5));
  const dueDateIso = dueDate.toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);

  const { data: leases, error } = await admin
    .from("pm_leases")
    .select("id, monthly_rent, start_date, end_date")
    .eq("status", "active")
    .lte("start_date", todayIso)
    .gte("end_date", todayIso);

  if (error) throw error;

  let created = 0;
  for (const lease of leases ?? []) {
    const { error: insertError } = await admin.from("pm_rent_invoices").insert({
      lease_id: lease.id,
      period_month: periodMonth,
      amount_due: lease.monthly_rent,
      due_date: dueDateIso,
      status: "pending",
    });
    // Unique (lease_id, period_month) — ignore duplicates
    if (!insertError) {
      created += 1;
      continue;
    }
    if (!/duplicate|unique/i.test(insertError.message ?? "")) {
      console.warn("[pm-cron] invoice insert:", insertError.message);
    }
  }

  return { created };
}

export async function flagPmOverdueInvoices(admin: PmDb): Promise<{ updated: number }> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("pm_rent_invoices")
    .update({ status: "overdue" })
    .in("status", ["pending", "partial"])
    .lt("due_date", todayIso)
    .select("id");

  if (error) throw error;
  return { updated: data?.length ?? 0 };
}
