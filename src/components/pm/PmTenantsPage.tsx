import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  addPmTenant,
  createPmLease,
  endPmLease,
  getPmProperty,
  invitePmTenantPortal,
  listPmTenants,
  updatePmLeaseRent,
} from "@/lib/api/pm.functions";
import { formatKes } from "@/lib/properties";
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
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [editingLeaseId, setEditingLeaseId] = useState<string | null>(null);
  const [editLeaseRent, setEditLeaseRent] = useState(0);

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

  const updateLeaseRent = useMutation({
    mutationFn: () =>
      updatePmLeaseRent({
        data: {
          leaseId: editingLeaseId!,
          monthlyRent: editLeaseRent,
          applyToCurrentInvoice: true,
        },
      }),
    onSuccess: () => {
      toast.success("Monthly rent updated for the lease");
      setEditingLeaseId(null);
      qc.invalidateQueries({ queryKey: ["pm-tenants", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-property", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-invoices", propertyId] });
      qc.invalidateQueries({ queryKey: ["pm-dashboard", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shareToWhatsApp = useCallback((url: string, tenantName: string, tenantPhone?: string) => {
    const text = `Hi ${tenantName}, you're invited to manage your tenancy on NyumbaSearch. Open this link to accept: ${url}`;
    const waUrl = tenantPhone
      ? `https://wa.me/${tenantPhone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    globalThis.open(waUrl, "_blank", "noopener");
  }, []);

  const invite = useMutation({
    mutationFn: (id: string) => invitePmTenantPortal({ data: { tenantId: id } }),
    onSuccess: (res, tenantId) => {
      if (res.inviteUrl) {
        setInviteLinks((prev) => ({ ...prev, [tenantId]: res.inviteUrl }));
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(res.inviteUrl).catch(() => undefined);
        }
      }
      const tenant = tenants.find((t: { id: string }) => t.id === tenantId) as
        | { id: string; full_name: string; phone: string }
        | undefined;

      if (res.emailSent) {
        toast.success("Invite email sent", {
          description: "Link valid 14 days. Copied to clipboard.",
          action: res.inviteUrl
            ? {
                label: "Share on WhatsApp",
                onClick: () =>
                  shareToWhatsApp(res.inviteUrl, tenant?.full_name ?? "there", tenant?.phone),
              }
            : undefined,
        });
      } else if (res.smsSent) {
        toast.success("Invite sent by SMS", {
          description: res.deliveryWarning ?? "Email failed; SMS delivered. Link copied.",
          action: res.inviteUrl
            ? {
                label: "Also share on WhatsApp",
                onClick: () =>
                  shareToWhatsApp(res.inviteUrl, tenant?.full_name ?? "there", tenant?.phone),
              }
            : undefined,
        });
      } else {
        toast.warning("Invite created — share the link", {
          description:
            res.deliveryWarning ??
            "Email could not be sent. Link copied — share it with the tenant.",
          duration: 12_000,
          action: res.inviteUrl
            ? {
                label: "Share on WhatsApp",
                onClick: () =>
                  shareToWhatsApp(res.inviteUrl, tenant?.full_name ?? "there", tenant?.phone),
              }
            : undefined,
        });
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
                      {formatKes(l.monthly_rent)} / month · {l.start_date} → {l.end_date}
                    </div>
                    {editingLeaseId === l.id ? (
                      <form
                        className="mt-2 flex flex-wrap items-end gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          updateLeaseRent.mutate();
                        }}
                      >
                        <label className="text-xs">
                          <span className="block">Monthly rent (KES)</span>
                          <input
                            type="number"
                            min={0}
                            required
                            value={editLeaseRent}
                            onChange={(e) => setEditLeaseRent(Number(e.target.value))}
                            className="mt-1 block w-32 rounded-lg border border-border px-2 py-1.5 text-sm"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={updateLeaseRent.isPending}
                          className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLeaseId(null)}
                          className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLeaseId(l.id);
                        setEditLeaseRent(l.monthly_rent);
                      }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      Edit rent
                    </button>
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
                  </div>
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
              <div className="flex flex-wrap gap-2">
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
                {(inviteLinks[t.id] || t.portal_status === "invited") &&
                t.portal_status !== "accepted" ? (
                  <button
                    type="button"
                    onClick={() => {
                      const url = inviteLinks[t.id];
                      if (url) {
                        shareToWhatsApp(url, t.full_name, t.phone);
                      } else {
                        toast.info("Tap 'Invite to portal' first to generate the link.");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-600/40 bg-green-600/10 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-600/20 dark:text-green-400"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </button>
                ) : null}
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
