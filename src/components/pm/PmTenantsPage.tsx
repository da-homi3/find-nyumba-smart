import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  addPmTenant,
  createPmLease,
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

  const invite = useMutation({
    mutationFn: (id: string) => invitePmTenantPortal({ data: { tenantId: id } }),
    onSuccess: (res) => {
      toast.success("Invite sent", {
        description: `Token ready (${res.inviteToken.slice(0, 8)}…)`,
      });
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
  const vacantUnits = units.filter((u: { status: string }) => u.status === "vacant");

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
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="">Select tenant</option>
            {tenants.map((t: { id: string; full_name: string }) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
          <select
            required
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="">Select vacant unit</option>
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
