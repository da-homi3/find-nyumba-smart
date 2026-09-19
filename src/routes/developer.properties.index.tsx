import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeveloperShell } from "@/components/DeveloperShell";
import { listAgencyProperties, updatePropertyVacancy } from "@/lib/api/nyumba.functions";
import { formatKes, type Property } from "@/lib/properties";
import { PropertyMediaManager } from "@/components/PropertyMediaManager";
import { Plus, Building2 } from "lucide-react";
import { ListingGridSkeleton } from "@/components/skeletons/ListingCardSkeleton";
import { toast } from "sonner";
import { optimizeImageUrlForServeMode } from "@/lib/app-client";

export const Route = createFileRoute("/developer/properties/")({
  component: () => (
    <DeveloperShell>
      <Page />
    </DeveloperShell>
  ),
});

function Page() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["developer-properties"],
    queryFn: () => listAgencyProperties(),
  });

  const vacancyMutation = useMutation({
    mutationFn: (args: { propertyId: string; isVacant: boolean }) =>
      updatePropertyVacancy({ data: args }),
    onSuccess: (_, vars) => {
      toast.success(vars.isVacant ? "Marked as vacant" : "Marked as filled");
      qc.invalidateQueries({ queryKey: ["developer-properties"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Developer listings</h1>
          <p className="text-sm text-muted-foreground">{data.length} properties</p>
        </div>
        <Link
          to="/developer/properties/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add listing
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-8">
          <ListingGridSkeleton count={6} />
        </div>
      ) : data.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed bg-card p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No listings yet.</p>
          <Link to="/developer/properties/new" className="mt-4 inline-block text-sm font-semibold text-primary">
            Add your first listing →
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p: Property) => (
            <div key={p.id} className="overflow-hidden rounded-2xl border bg-card">
              {p.images?.[0] ? (
                <img
                  src={optimizeImageUrlForServeMode(p.images[0], { width: 640 }) ?? p.images[0]}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-muted">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-2 p-4">
                <h2 className="font-display text-lg font-semibold">{p.title}</h2>
                <p className="text-sm text-muted-foreground">{formatKes(p.rent_kes)} / mo</p>
                <PropertyMediaManager propertyId={p.id} />
                <button
                  type="button"
                  disabled={vacancyMutation.isPending}
                  onClick={() =>
                    vacancyMutation.mutate({ propertyId: p.id, isVacant: !p.is_vacant })
                  }
                  className="text-xs font-semibold text-primary"
                >
                  Mark as {p.is_vacant ? "filled" : "vacant"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
