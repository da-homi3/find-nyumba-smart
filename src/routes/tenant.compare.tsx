import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { compareProperties } from "@/lib/api/search.functions";
import { formatKes, prettyType } from "@/lib/properties";
import { SiteNav } from "@/components/SiteNav";

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
  const ids = (idsParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    .slice(0, 4);

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

  return (
    <div className="min-h-screen bg-background pb-16">
      <SiteNav variant="light" />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="font-display text-2xl font-semibold">Compare listings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add <code className="text-xs">?ids=uuid1,uuid2</code> or pick from recently viewed homes.
        </p>

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
          <div className="mt-6 overflow-x-auto">
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
        )}
      </div>
    </div>
  );
}
