import { useState, type SubmitEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adjustAdminPlusCredits,
  listAdminFinancialPartners,
  listAdminTenants,
  refundAdminContactUnlock,
  setAdminFinancialPartnerStatus,
  setAdminTenantPlus,
  upsertAdminFinancialPartner,
} from "@/lib/api/admin.functions";
import { AdminAsyncPanel, AdminField } from "@/components/admin/admin-shared";

import { AdminPlusCommercialPanel } from "@/components/admin/AdminPlusCommercialPanel";

export function AdminTenantsTab() {
  return (
    <div className="space-y-10">
      <AdminPlusCommercialPanel />
      <AdminLendersPanel />
      <AdminTenantWalletsPanel />
    </div>
  );
}

function AdminLendersPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [applicationUrl, setApplicationUrl] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [disclosure, setDisclosure] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("inactive");

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["admin-lenders"],
    queryFn: () => listAdminFinancialPartners(),
  });

  const save = useMutation({
    mutationFn: () =>
      upsertAdminFinancialPartner({
        data: {
          name,
          product,
          status,
          applicationUrl: applicationUrl.trim() || undefined,
          eligibility: eligibility.trim() || undefined,
          disclosure: disclosure.trim() || undefined,
        },
      }),
    onSuccess: (row) => {
      toast.success(`${row.name} saved`);
      setName("");
      setProduct("");
      setApplicationUrl("");
      setEligibility("");
      setDisclosure("");
      setStatus("inactive");
      void qc.invalidateQueries({ queryKey: ["admin-lenders"] });
      void qc.invalidateQueries({ queryKey: ["admin-audits"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: (payload: { id: string; status: "active" | "inactive" }) =>
      setAdminFinancialPartnerStatus({ data: payload }),
    onSuccess: () => {
      toast.success("Lender status updated");
      void qc.invalidateQueries({ queryKey: ["admin-lenders"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Lenders & financial partners</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a partner only when a real product exists. Inactive partners stay hidden from Tenant
          Plus finance tools. Include a disclosure for regulated products.
        </p>
      </div>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <AdminField label="Lender / partner name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="e.g. Partner bank name"
          />
        </AdminField>
        <AdminField label="Product">
          <input
            required
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="e.g. Rent deposit facility"
          />
        </AdminField>
        <AdminField label="Application URL (optional)" className="text-xs sm:col-span-2">
          <input
            value={applicationUrl}
            onChange={(e) => setApplicationUrl(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="https://"
          />
        </AdminField>
        <AdminField label="Eligibility notes">
          <input
            value={eligibility}
            onChange={(e) => setEligibility(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Who this product is for"
          />
        </AdminField>
        <AdminField label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          >
            <option value="inactive">Inactive (hidden)</option>
            <option value="active">Active (visible to Plus tenants)</option>
          </select>
        </AdminField>
        <AdminField label="Disclosure" className="text-xs sm:col-span-2">
          <textarea
            value={disclosure}
            onChange={(e) => setDisclosure(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            rows={3}
            placeholder="Required for regulated credit products"
          />
        </AdminField>
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground sm:col-span-2"
        >
          {save.isPending ? "Saving…" : "Add lender"}
        </button>
      </form>
      <AdminAsyncPanel
        loading={isLoading}
        loadingMessage="Loading partners…"
        isEmpty={partners.length === 0}
        emptyContent={<p className="text-sm text-muted-foreground">No lenders yet.</p>}
      >
        <div className="space-y-3">
          {partners.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4"
            >
              <div>
                <p className="text-sm font-semibold">
                  {p.name} — {p.product}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.status}
                  {p.eligibility ? ` · ${p.eligibility}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border px-3 py-1.5 text-xs font-semibold"
                disabled={toggle.isPending}
                onClick={() =>
                  toggle.mutate({
                    id: p.id,
                    status: p.status === "active" ? "inactive" : "active",
                  })
                }
              >
                {p.status === "active" ? "Hide" : "Publish"}
              </button>
            </div>
          ))}
        </div>
      </AdminAsyncPanel>
    </section>
  );
}

function AdminTenantWalletsPanel() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [listingId, setListingId] = useState("");
  const [refundUserId, setRefundUserId] = useState("");
  const [refundReason, setRefundReason] = useState("Invalid contact / listing removed");

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["admin-tenants", search],
    enabled: search.length > 0,
    queryFn: () => listAdminTenants({ data: { query: search, limit: 25 } }),
  });

  const adjust = useMutation({
    mutationFn: (payload: { userId: string; delta: number; reason: string }) =>
      adjustAdminPlusCredits({ data: payload }),
    onSuccess: (row) => {
      toast.success(`Credits now ${row.plusContactCredits}`);
      void qc.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const plus = useMutation({
    mutationFn: (payload: { userId: string; action: "grant" | "revoke" }) =>
      setAdminTenantPlus({ data: payload }),
    onSuccess: (row) => {
      toast.success(row.tenantPlan === "plus" ? "Tenant Plus granted" : "Tenant Plus revoked");
      void qc.invalidateQueries({ queryKey: ["admin-tenants"] });
      void qc.invalidateQueries({ queryKey: ["admin-audits"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refund = useMutation({
    mutationFn: () =>
      refundAdminContactUnlock({
        data: {
          userId: refundUserId.trim(),
          listingId: listingId.trim(),
          reason: refundReason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Contact unlock refunded");
      setListingId("");
      void qc.invalidateQueries({ queryKey: ["admin-audits"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function runSearch(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(query.trim());
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-lg font-semibold">Tenant Plus wallets</h2>
      <p className="text-sm text-muted-foreground">
        Search tenants to grant credits, grant/revoke Plus, or refund an invalid contact unlock.
      </p>
      <form onSubmit={runSearch} className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, phone, or UUID"
          className="min-w-55 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Search
        </button>
      </form>
      {!search ? (
        <p className="text-sm text-muted-foreground">Enter a search to load tenant wallets.</p>
      ) : (
        <AdminAsyncPanel
          loading={isLoading}
          loadingMessage="Searching tenants…"
          isEmpty={tenants.length === 0}
          emptyContent={<p className="text-sm text-muted-foreground">No matching tenants.</p>}
        >
          <div className="space-y-3">
            {tenants.map((t) => (
              <div
                key={t.userId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4"
              >
                <div>
                  <p className="text-sm font-semibold">{t.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.tenantPlan} · {t.plusContactCredits} credits
                    {t.phone ? ` · ${t.phone}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{t.userId}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-1.5 text-xs font-semibold"
                    disabled={adjust.isPending}
                    onClick={() =>
                      adjust.mutate({ userId: t.userId, delta: 1, reason: "admin grant +1" })
                    }
                  >
                    +1 credit
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-1.5 text-xs font-semibold"
                    disabled={adjust.isPending}
                    onClick={() =>
                      adjust.mutate({ userId: t.userId, delta: 10, reason: "admin grant +10" })
                    }
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-1.5 text-xs font-semibold"
                    disabled={plus.isPending}
                    onClick={() => plus.mutate({ userId: t.userId, action: "grant" })}
                  >
                    Grant Plus
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-1.5 text-xs font-semibold"
                    disabled={plus.isPending}
                    onClick={() => plus.mutate({ userId: t.userId, action: "revoke" })}
                  >
                    Revoke Plus
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-1.5 text-xs font-semibold"
                    onClick={() => setRefundUserId(t.userId)}
                  >
                    Use for refund
                  </button>
                </div>
              </div>
            ))}
          </div>
        </AdminAsyncPanel>
      )}

      <form
        className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          refund.mutate();
        }}
      >
        <h3 className="font-semibold sm:col-span-2">Refund contact unlock</h3>
        <AdminField label="Tenant user id">
          <input
            required
            value={refundUserId}
            onChange={(e) => setRefundUserId(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-mono"
          />
        </AdminField>
        <AdminField label="Listing id">
          <input
            required
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-mono"
          />
        </AdminField>
        <AdminField label="Reason" className="text-xs sm:col-span-2">
          <input
            required
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </AdminField>
        <button
          type="submit"
          disabled={refund.isPending}
          className="rounded-xl border px-4 py-2 text-sm font-semibold sm:col-span-2"
        >
          {refund.isPending ? "Refunding…" : "Refund unlock"}
        </button>
      </form>
    </section>
  );
}
