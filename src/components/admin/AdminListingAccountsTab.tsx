import { useState, type SubmitEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import {
  adjustAdminListingLimit,
  listAdminListingAccounts,
  resetAdminListingLimit,
} from "@/lib/api/admin.functions";
import { AdminAsyncPanel } from "@/components/admin/admin-shared";
import { AdminListingLimitControls } from "@/components/admin/AdminListingLimitControls";

type ListingAccountRole = "landlord" | "agency" | "manager" | "";

export function AdminListingAccountsTab() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<ListingAccountRole>("");
  const [search, setSearch] = useState({ query: "", role: "" as ListingAccountRole });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["admin-listing-accounts", search.query, search.role],
    queryFn: () =>
      listAdminListingAccounts({
        data: {
          query: search.query || undefined,
          role: search.role || undefined,
          limit: 50,
        },
      }),
  });

  const adjustLimit = useMutation({
    mutationFn: (payload: { userId: string; delta: number }) =>
      adjustAdminListingLimit({ data: payload }),
    onSuccess: (row) => {
      toast.success(`Listing limit set to ${row.listingLimit}`);
      void qc.invalidateQueries({ queryKey: ["admin-listing-accounts"] });
      void qc.invalidateQueries({ queryKey: ["admin-audits"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetLimit = useMutation({
    mutationFn: (payload: { userId: string }) => resetAdminListingLimit({ data: payload }),
    onSuccess: (row) => {
      toast.success(`Listing limit reset to plan default (${row.listingLimit})`);
      void qc.invalidateQueries({ queryKey: ["admin-listing-accounts"] });
      void qc.invalidateQueries({ queryKey: ["admin-audits"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function runSearch(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch({ query: query.trim(), role });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Search landlords, agencies, and property managers to raise or lower how many active listings
        they can publish. Overrides replace the plan cap until you reset to plan default.
      </p>

      <form onSubmit={runSearch} className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, phone, or organization"
              className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ListingAccountRole)}
            className="rounded-xl border bg-background px-3 py-2.5 text-sm"
          >
            <option value="">All listing accounts</option>
            <option value="landlord">Landlord</option>
            <option value="agency">Agency</option>
            <option value="manager">Property manager</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Search
        </button>
      </form>

      <AdminAsyncPanel
        loading={isLoading}
        loadingMessage="Loading listing accounts…"
        isEmpty={!isLoading && accounts.length === 0}
        emptyContent={
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            No listing accounts match this search.
          </div>
        }
        skeletonCols={6}
      >
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Active</th>
                <th className="px-4 py-3 text-left">Plan cap</th>
                <th className="px-4 py-3 text-left">Limit</th>
                <th className="px-4 py-3 text-left">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accounts.map((account) => (
                <tr key={account.userId}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{account.fullName ?? "Unnamed account"}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.organizationName ?? account.phone ?? account.userId}
                    </p>
                  </td>
                  <td className="px-4 py-3 capitalize">{account.portalRole}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {account.activeListings} / {account.listingLimit}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {account.planLimit}
                    {account.bonusListingSlots > 0 ? ` + ${account.bonusListingSlots} bonus` : ""}
                    {account.adminListingLimitOverride != null ? " · overridden" : ""}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{account.listingLimit}</td>
                  <td className="px-4 py-3">
                    <AdminListingLimitControls
                      userId={account.userId}
                      listingLimit={account.listingLimit}
                      hasOverride={account.adminListingLimitOverride != null}
                      adjustLimit={adjustLimit}
                      resetLimit={resetLimit}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminAsyncPanel>
    </div>
  );
}
