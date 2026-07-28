-- Speed up monthly invoice generation: active leases by date window.
CREATE INDEX IF NOT EXISTS idx_pm_leases_active_date_range
  ON public.pm_leases (start_date, end_date)
  WHERE status = 'active';

-- Speed up invoice history lookups by lease (PM rent UI).
CREATE INDEX IF NOT EXISTS idx_pm_rent_invoices_lease_period
  ON public.pm_rent_invoices (lease_id, period_month DESC);
