import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { compareProperties } from "@/lib/api/search.functions";
import { getAssistantReply } from "@/lib/api/ai.functions";
import { formatKes, prettyType } from "@/lib/properties";
import { SiteNav } from "@/components/SiteNav";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PremiumFeatureLock } from "@/components/PremiumFeatureLock";
import { TENANT_PLUS_CONFIG, maxComparedProperties } from "@/lib/revenue/tenant-plus-config";

const compareSearchSchema = z.object({
  ids: z.string().optional(),
});

export const Route = createFileRoute("/tenant/compare")({
  validateSearch: compareSearchSchema,
  head: () => ({ meta: [{ title: "Compare homes — NyumbaSearch" }] }),
  component: ComparePage,
});

function ComparePage() {
  const { ids: idsParam } = Route.useSearch();
  const { isPlus } = useEntitlements();
  const cap = maxComparedProperties(isPlus);
  const allIds = (idsParam ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter((s: string) => /^[0-9a-f-]{36}$/i.test(s));
  const truncated = Number.isFinite(cap) && allIds.length > cap;
  const ids = allIds.slice(0, Number.isFinite(cap) ? cap : allIds.length);

  const {
    data: properties = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["compare", ids.join(",")],
    enabled: ids.length >= 2,
    queryFn: () => compareProperties({ data: { ids } }),
  });

  const aiCompare = useMutation({
    mutationFn: () =>
      getAssistantReply({
        data: {
          message: "Compare these listings for my stated requirements.",
          propertyIds: ids.slice(0, 4),
        },
      }),
  });

  return (
    <div className="min-h-screen bg-background pb-16">
      <SiteNav variant="light" />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="font-display text-2xl font-semibold">Compare listings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add <code className="text-xs">?ids=uuid1,uuid2</code> or pick from recently viewed homes.
        </p>
        {truncated ? (
          <div className="mt-4">
            <PremiumFeatureLock
              compact
              title="Compare more homes"
              body={`Free plan compares up to ${TENANT_PLUS_CONFIG.freeCompareLimit} listings. Tenant Plus compares up to ${TENANT_PLUS_CONFIG.plusCompareLimit}.`}
            />
          </div>
        ) : null}

        {ids.length < 2 ? (
          <div className="mt-8 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Select at least two listings to compare. Browse{" "}
            <Link to="/tenant" className="font-semibold text-primary">
              homes
            </Link>{" "}
            and use Recently viewed → Compare.
          </div>
        ) : isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading comparison…</p>
        ) : isError ? (
          <div className="mt-8 rounded-2xl border border-destructive/30 p-8 text-center">
            <p className="text-sm text-destructive">Could not load listings.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 rounded-xl border px-4 py-2 text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-4 md:hidden">
              {properties.map((p) => (
                <article key={p.id} className="rounded-2xl border p-4">
                  <Link
                    to="/tenant/property/$id"
                    params={{ id: p.id }}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {p.title}
                  </Link>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Rent / mo</dt>
                      <dd className="font-medium">{formatKes(p.rent_kes)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Neighborhood</dt>
                      <dd className="font-medium">{p.neighborhood}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Type</dt>
                      <dd className="font-medium">{prettyType(p.property_type)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Beds / Baths</dt>
                      <dd className="font-medium">
                        {p.bedrooms} / {p.bathrooms}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Verified</dt>
                      <dd className="font-medium">{p.is_verified ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Health score</dt>
                      <dd className="font-medium">{p.health_score ?? 0}%</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="mt-6 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3">Field</th>
                    {properties.map((p) => (
                      <th key={p.id} className="p-3 font-semibold normal-case text-foreground">
                        <Link
                          to="/tenant/property/$id"
                          params={{ id: p.id }}
                          className="hover:text-primary"
                        >
                          {p.title}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Rent / mo", (p: (typeof properties)[0]) => formatKes(p.rent_kes)],
                      ["Neighborhood", (p: (typeof properties)[0]) => p.neighborhood],
                      ["Type", (p: (typeof properties)[0]) => prettyType(p.property_type)],
                      ["Beds", (p: (typeof properties)[0]) => String(p.bedrooms)],
                      ["Baths", (p: (typeof properties)[0]) => String(p.bathrooms)],
                      ["Verified", (p: (typeof properties)[0]) => (p.is_verified ? "Yes" : "No")],
                      ["Health score", (p: (typeof properties)[0]) => `${p.health_score ?? 0}%`],
                    ] as const
                  ).map(([label, render]) => (
                    <tr key={label} className="border-b">
                      <td className="p-3 font-medium text-muted-foreground">{label}</td>
                      {properties.map((p) => (
                        <td key={p.id} className="p-3">
                          {render(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-8 rounded-2xl border bg-card p-4">
              <h2 className="font-display text-lg font-semibold">AI comparison</h2>
              {!isPlus ? (
                <div className="mt-3">
                  <PremiumFeatureLock
                    compact
                    title="AI comparison"
                    body="Tenant Plus explains trade-offs across these homes using live listing data."
                  />
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={aiCompare.isPending}
                    onClick={() => aiCompare.mutate()}
                    className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    {aiCompare.isPending ? "Comparing…" : "Compare with NyumbaSearch AI"}
                  </button>
                  {aiCompare.data?.reply ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {aiCompare.data.reply}
                    </p>
                  ) : null}
                  {aiCompare.isError ? (
                    <p className="mt-3 text-sm text-destructive">
                      {(aiCompare.error as Error).message}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
