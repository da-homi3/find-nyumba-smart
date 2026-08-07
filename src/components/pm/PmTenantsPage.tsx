import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  addPmTenant,
  createPmLease,
  endPmLease,
  getPmProperty,
  invitePmTenantPortal,
  listPmTenants,
} from "@/lib/api/pm.functions";
import { PmPropertySubnav, type PmPortal } from "@/components/pm/pm-nav";

export function PmTenantsPage({
  portal,
  propertyId,
}: Readonly<{ portal: PmPortal; propertyId: string }>) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["pm-property", propertyId],
    queryFn: () => getPmProperty({ data: { propertyId } }),
  });
  const tenantsQ = useQuery({
    queryKey: ["pm-tenants", propertyId],
    queryFn: () => listPmTenants({ data: { propertyId } }),
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [monthlyRent, setMonthlyRent] = useState(25000);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const addTenant = useMutation({
    mutationFn: () =>
      addPmTenant({
        data: {
          propertyId,
          fullName,
          phone,
          email: email || null,
        },
      }),
    onSuccess: () => {
      toast.success("Tenant added");
      setFullName("");
      setPhone("");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["pm-tenants", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-property", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lease = useMutation({
    mutationFn: () =>
      createPmLease({
        data: {
          unitId,
          tenantId,
          monthlyRent,
          startDate,
          endDate,
        },
      }),
    onSuccess: () => {
      toast.success("Lease created");
      qc.invalidateQueries({ queryKey: ["pm-tenants", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-property", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-dashboard", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const endLease = useMutation({
    mutationFn: (leaseId: string) => endPmLease({ data: { leaseId } }),
    onSuccess: () => {
      toast.success("Lease ended — unit marked vacant");
      qc.invalidateQueries({ queryKey: ["pm-tenants", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-property", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-dashboard", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invite = useMutation({
    mutationFn: (id: string) => invitePmTenantPortal({ data: { tenantId: id } }),
    onSuccess: (res) => {
      toast.success("Invite email sent", {
        description: "Tenant will get a direct nyumbasearch.com link (valid 14 days).",
      });
      if (res.inviteUrl && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(res.inviteUrl).catch(() => undefined);
      }
      qc.invalidateQueries({ queryKey: ["pm-tenants", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isLoading || tenantsQ.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!detail.data) return null;

  const { property, units } = detail.data;
  const tenants = tenantsQ.data?.tenants ?? [];
  const leases = tenantsQ.data?.leases ?? [];
  const vacantUnits = units.filter((u: { status: string }) => u.status === "vacant");
  const tenantName = new Map(
    tenants.map((t: { id: string; full_name: string }) => [t.id, t.full_name]),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">{property.name} · Tenants</h1>
      <div className="mt-6">
        <PmPropertySubnav portal={portal} propertyId={propertyId} active="tenants" />
      </div>

      <section className="mb-8 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">Add tenant</h2>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            addTenant.mutate();
          }}
        >
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (for portal invite)"
            className="sm:col-span-2 rounded-lg border border-border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={addTenant.isPending}
            className="sm:col-span-2 rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background"
          >
            Add tenant
          </button>
        </form>
      </section>

      <section className="mb-8 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">Attach lease</h2>
        {tenants.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Add a tenant above first — their name will appear in this list.
          </p>
        ) : null}
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            lease.mutate();
          }}
        >
          <select
            required
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            disabled={tenants.length === 0}
            className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-60"
          >
            <option value="">
              {tenants.length === 0 ? "No tenants yet — add one above" : "Select tenant"}
            </option>
            {tenants.map((t: { id: string; full_name: string }) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
          <select
            required
            value={unitId}
            disabled={vacantUnits.length === 0}
            onChange={(e) => {
              setUnitId(e.target.value);
              const unit = vacantUnits.find((u: { id: string }) => u.id === e.target.value) as
                | { monthly_rent?: number }
                | undefined;
              if (unit?.monthly_rent) setMonthlyRent(unit.monthly_rent);
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-60"
          >
            <option value="">
              {vacantUnits.length === 0 ? "No vacant units" : "Select vacant unit"}
            </option>
            {vacantUnits.map((u: { id: string; unit_label: string; monthly_rent: number }) => (
              <option key={u.id} value={u.id}>
                {u.unit_label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            required
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(Number(e.target.value))}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            />
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={lease.isPending}
            className="sm:col-span-2 rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background"
          >
            Create lease
          </button>
        </form>
      </section>

      {leases.length > 0 ? (
        <section className="mb-8 rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold">Active leases</h2>
          <ul className="mt-3 space-y-2">
            {leases.map(
              (l: {
                id: string;
                tenant_id: string;
                monthly_rent: number;
                start_date: string;
                end_date: string;
                pm_units?: { unit_label?: string };
              }) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5"
                >
                  <div className="text-sm">
                    <div className="font-medium">
                      {tenantName.get(l.tenant_id) ?? "Tenant"} · {l.pm_units?.unit_label ?? "Unit"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      KES {l.monthly_rent.toLocaleString()} · {l.start_date} → {l.end_date}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={endLease.isPending}
                    onClick={() => {
                      if (
                        globalThis.confirm(
                          "End this lease and mark the unit vacant? This cannot be undone.",
                        )
                      ) {
                        endLease.mutate(l.id);
                      }
                    }}
                    className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                  >
                    End lease
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>
      ) : null}

      <ul className="space-y-2">
        {tenants.map(
          (t: {
            id: string;
            full_name: string;
            phone: string;
            email: string | null;
            portal_status: string;
          }) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div>
                <div className="font-medium">{t.full_name}</div>
                <div className="text-sm text-muted-foreground">
                  {t.phone}
                  {t.email ? ` · ${t.email}` : ""}
                </div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  portal: {t.portal_status}
                </div>
              </div>
              {t.email && t.portal_status !== "accepted" ? (
                <button
                  type="button"
                  disabled={invite.isPending}
                  onClick={() => invite.mutate(t.id)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  Invite to portal
                </button>
              ) : null}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
