import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AgencyShell } from "@/components/AgencyShell";
import { listAgencyProperties } from "@/lib/api/nyumba.functions";
import { formatKes } from "@/lib/properties";
import { PropertyMediaManager } from "@/components/PropertyMediaManager";
import { Plus } from "lucide-react";
import { ListingGridSkeleton } from "@/components/skeletons/ListingCardSkeleton";

export const Route = createFileRoute("/agency/properties")({
  component: () => (
    <AgencyShell>
      <Page />
    </AgencyShell>
  ),
});

function Page() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["agency-properties"],
    queryFn: () => listAgencyProperties(),
  });

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Agency listings</h1>
          <p className="text-sm text-muted-foreground">{data.length} properties</p>
        </div>
        <Link
          to="/agency/properties/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add listing
        </Link>
      </div>
      {isLoading ? (
        <ListingGridSkeleton count={6} />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <div key={p.id} className="rounded-2xl border bg-card p-4">
              {p.images[0] && (
                <img
                  src={p.images[0]}
                  alt=""
                  className="mb-3 h-32 w-full rounded-lg object-cover"
                />
              )}
              <p className="font-semibold">{p.title}</p>
              <p className="text-xs text-muted-foreground">{p.neighborhood}</p>
              <p className="mt-2 text-sm font-semibold">{formatKes(p.rent_kes)}</p>
              <Link
                to="/agency/properties/$id/edit"
                params={{ id: p.id }}
                className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
              >
                Edit listing →
              </Link>
              <PropertyMediaManager property={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
