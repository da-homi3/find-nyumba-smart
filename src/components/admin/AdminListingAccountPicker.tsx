import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Search, Users } from "lucide-react";
import { listAdminListingAccounts } from "@/lib/api/admin.functions";
import type { ListingOnBehalfTarget } from "@/components/PropertyListingWizard";
import { cn } from "@/lib/utils";

type RoleFilter = "all" | "landlord" | "agency" | "manager";

type Account = Awaited<ReturnType<typeof listAdminListingAccounts>>[number];

type Props = Readonly<{
  selected: ListingOnBehalfTarget | null;
  onSelect: (target: ListingOnBehalfTarget) => void;
}>;

const ROLE_FILTERS: ReadonlyArray<readonly [RoleFilter, string]> = [
  ["all", "All"],
  ["landlord", "Landlords"],
  ["manager", "Managers"],
  ["agency", "Agencies"],
];

function roleLabel(role: ListingOnBehalfTarget["portalRole"]): string {
  if (role === "agency") return "Agency";
  if (role === "manager") return "Property manager";
  return "Landlord";
}

function accountDisplayName(account: Account): string {
  return account.organizationName ?? account.fullName ?? account.phone ?? "Unnamed account";
}

function activeListingsLabel(count: number): string {
  const suffix = count === 1 ? "" : "s";
  return `${count} active listing${suffix}`;
}

function roleFilterClass(active: boolean): string {
  return cn(
    "rounded-full px-3 py-1.5 text-xs font-semibold",
    active ? "bg-primary text-primary-foreground" : "border bg-background text-muted-foreground",
  );
}

function accountRowClass(selected: boolean): string {
  return cn(
    "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition",
    selected
      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
      : "hover:border-primary/30 hover:bg-secondary/40",
  );
}

function AccountRow({
  account,
  selected,
  onSelect,
}: Readonly<{
  account: Account;
  selected: boolean;
  onSelect: (target: ListingOnBehalfTarget) => void;
}>) {
  const displayName = accountDisplayName(account);
  const showContactName = Boolean(account.fullName && account.organizationName);
  const showRoles = account.roles.length > 1;

  return (
    <button
      type="button"
      onClick={() =>
        onSelect({
          userId: account.userId,
          displayName,
          portalRole: account.portalRole,
        })
      }
      className={accountRowClass(selected)}
    >
      <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-secondary">
        {account.portalRole === "landlord" ? (
          <Building2 className="h-4 w-4 text-primary" />
        ) : (
          <Users className="h-4 w-4 text-primary" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{displayName}</p>
        <p className="text-xs text-muted-foreground">
          {roleLabel(account.portalRole)}
          {showContactName ? ` · ${account.fullName}` : ""}
          {account.phone ? ` · ${account.phone}` : ""}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {activeListingsLabel(account.activeListings)}
          {showRoles ? ` · Roles: ${account.roles.join(", ")}` : ""}
        </p>
      </div>
    </button>
  );
}

function AccountResults({
  loading,
  accounts,
  selected,
  onSelect,
}: Readonly<{
  loading: boolean;
  accounts: Account[];
  selected: ListingOnBehalfTarget | null;
  onSelect: (target: ListingOnBehalfTarget) => void;
}>) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading accounts…</p>;
  }
  if (accounts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No matching accounts. Try a different name or organization.
      </p>
    );
  }
  return (
    <>
      {accounts.map((account) => (
        <AccountRow
          key={account.userId}
          account={account}
          selected={selected?.userId === account.userId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export function AdminListingAccountPicker({ selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: accounts = [], isFetching } = useQuery({
    queryKey: ["admin-listing-accounts", searchTerm, roleFilter],
    queryFn: () =>
      listAdminListingAccounts({
        data: {
          query: searchTerm || undefined,
          role: roleFilter === "all" ? undefined : roleFilter,
          limit: 30,
        },
      }),
  });

  function runSearch() {
    setSearchTerm(query.trim());
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Choose account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Search landlords, property managers, or agencies to publish a listing under their account.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {ROLE_FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setRoleFilter(id)}
            className={roleFilterClass(roleFilter === id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
            placeholder="Name, phone, or organization…"
            className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="button"
          onClick={runSearch}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Search
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <AccountResults
          loading={isFetching}
          accounts={accounts}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
    </section>
  );
}
