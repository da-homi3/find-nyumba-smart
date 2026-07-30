import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgencyShell } from "@/components/AgencyShell";
import { listAgencyProperties, updatePropertyVacancy } from "@/lib/api/nyumba.functions";
import { formatKes, type Property } from "@/lib/properties";
import { PropertyMediaManager } from "@/components/PropertyMediaManager";
import { Plus, Building2 } from "lucide-react";
import { ListingGridSkeleton } from "@/components/skeletons/ListingCardSkeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/agency/properties/")({
  component: () => (
    <AgencyShell>
      <Page />
    </AgencyShell>
  ),
});

function Page() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["agency-properties"],
    queryFn: () => listAgencyProperties(),
  });

  const vacancyMutation = useMutation({
    mutationFn: (args: { propertyId: string; isVacant: boolean }) =>
      updatePropertyVacancy({ data: args }),
    onSuccess: (_, vars) => {
      toast.success(vars.isVacant ? "Marked as vacant" : "Marked as filled");
      qc.invalidateQueries({ queryKey: ["agency-properties"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
      <AgencyPropertiesBody
        data={data}
        isLoading={isLoading}
        vacancyPending={vacancyMutation.isPending}
        onToggleVacancy={(propertyId, isVacant) => vacancyMutation.mutate({ propertyId, isVacant })}
      />
    </div>
  );
}

function AgencyPropertiesBody({
  data,
  isLoading,
  vacancyPending,
  onToggleVacancy,
}: Readonly<{
  data: Property[];
  isLoading: boolean;
  vacancyPending: boolean;
  onToggleVacancy: (propertyId: string, isVacant: boolean) => void;
}>) {
  if (isLoading) return <ListingGridSkeleton count={6} />;

  if (data.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border-2 border-dashed bg-card p-12 text-center">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">No agency listings yet.</p>
        <Link
          to="/agency/properties/new"
          className="mt-4 inline-block text-sm font-semibold text-primary"
        >
          Add your first listing →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((p) => {
        const isVacant = p.is_vacant !== false;
        return (
          <div key={p.id} className="rounded-2xl border bg-card p-4">
            {p.images[0] && (
              <img src={p.images[0]} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" />
            )}
            <p className="font-semibold">{p.title}</p>
            <p className="text-xs text-muted-foreground">{p.neighborhood}</p>
            <p className="mt-2 text-sm font-semibold">{formatKes(p.rent_kes)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  isVacant ? "bg-amber-500/15 text-amber-700" : "bg-success/15 text-success"
                }`}
              >
                {isVacant ? "Vacant" : "Filled"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  p.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {p.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <button
              type="button"
              disabled={vacancyPending}
              onClick={() => onToggleVacancy(p.id, !isVacant)}
              className="mt-3 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            >
              Mark as {isVacant ? "filled" : "vacant"}
            </button>
            <Link
              to="/agency/properties/$id/edit"
              params={{ id: p.id }}
              className="mt-2 block text-xs font-semibold text-primary hover:underline"
            >
              Edit listing →
            </Link>
            <PropertyMediaManager property={p} />
          </div>
        );
      })}
    </div>
  );
}
