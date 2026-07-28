import type { PmDb } from "@/lib/pm/access";

const INVOICE_INSERT_CHUNK = 100;

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

  const rows = (leases ?? []).map((lease: { id: string; monthly_rent: number }) => ({
    lease_id: lease.id,
    period_month: periodMonth,
    amount_due: lease.monthly_rent,
    due_date: dueDateIso,
    status: "pending" as const,
  }));

  if (rows.length === 0) return { created: 0 };

  let created = 0;
  for (let i = 0; i < rows.length; i += INVOICE_INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INVOICE_INSERT_CHUNK);
    const { data, error: insertError } = await admin
      .from("pm_rent_invoices")
      .upsert(chunk, {
        onConflict: "lease_id,period_month",
        ignoreDuplicates: true,
      })
      .select("id");

    if (insertError) {
      console.warn("[pm-cron] invoice upsert:", insertError.message);
      continue;
    }
    created += (data ?? []).length;
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
  const ids = (data ?? []).map((r: { id: string }) => r.id);
  if (ids.length) {
    const { onInvoicesFlaggedOverdue } = await import("@/lib/trust/hooks");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await onInvoicesFlaggedOverdue(supabaseAdmin, ids);
  }
  return { updated: ids.length };
}
