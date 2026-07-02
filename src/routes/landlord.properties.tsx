import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LandlordShell } from "@/components/LandlordShell";
import { useAuth } from "@/hooks/use-auth";
import { listLandlordProperties } from "@/lib/api/nyumba.functions";
import { markPropertyRented } from "@/lib/api/revenue.functions";
import { analyzePropertyQuality } from "@/lib/api/media.functions";
import { formatKes, prettyType } from "@/lib/properties";
import { PropertyMediaManager } from "@/components/PropertyMediaManager";
import { Plus, Building2, Sparkles, Loader2, TrendingUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ListingGridSkeleton } from "@/components/skeletons/ListingCardSkeleton";

export const Route = createFileRoute("/landlord/properties")({
  component: () => (
    <LandlordShell>
      <Page />
    </LandlordShell>
  ),
});

type Report = {
  property_id: string;
  score: number;
  grade: string;
  summary: string;
  created_at: string;
};

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["my-properties-list", user?.id],
    enabled: !!user,
    queryFn: () => listLandlordProperties(),
  });

  const { data: reports = [] } = useQuery<Report[]>({
    queryKey: ["my-property-reports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_quality_reports")
        .select("property_id, score, grade, summary, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const latestByProperty = new Map<string, Report>();
  for (const r of reports)
    if (!latestByProperty.has(r.property_id)) latestByProperty.set(r.property_id, r);

  const analyze = useMutation({
    mutationFn: (propertyId: string) => analyzePropertyQuality({ data: { propertyId } }),
    onSuccess: (report) => {
      toast.success(`Quality ${report.grade} · ${report.score}/100`, {
        description: report.summary,
      });
      qc.invalidateQueries({ queryKey: ["my-property-reports", user?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markRented = useMutation({
    mutationFn: (args: { propertyId: string; rentAmountKes: number }) =>
      markPropertyRented({ data: args }),
    onSuccess: (res) => {
      toast.success(`Marked as rented. Platform fee: ${formatKes(res.platformFeeKes)}`);
      qc.invalidateQueries({ queryKey: ["my-properties-list", user?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleMarkRented = (propertyId: string, rentKes: number) => {
    if (!globalThis.confirm("Mark this listing as rented? It will be deactivated.")) return;
    markRented.mutate({ propertyId, rentAmountKes: rentKes });
  };

  const renderPropertiesContent = () => {
    if (isLoading) return <ListingGridSkeleton count={6} />;
    if (properties.length === 0) {
      return (
        <div className="mt-10 rounded-2xl border-2 border-dashed bg-card p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-display text-lg font-semibold">No properties yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a property to start collecting leads.
          </p>
        </div>
      );
    }
    return (
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((p) => {
          const rep = latestByProperty.get(p.id);
          const isAnalyzing = analyze.isPending && analyze.variables === p.id;
          return (
            <div key={p.id} className="overflow-hidden rounded-2xl border bg-card shadow-soft">
              <div className="relative aspect-4/3 bg-muted">
                {p.images[0] && (
                  <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
                )}
                {rep && (
                  <span className="absolute right-2 top-2 rounded-full bg-foreground/90 px-2.5 py-1 text-xs font-semibold text-background">
                    {rep.grade} · {rep.score}
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="line-clamp-1 font-display font-semibold">{p.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {p.neighborhood} · {prettyType(p.property_type)}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-semibold text-primary">{formatKes(p.rent_kes)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                  >
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => analyze.mutate(p.id)}
                  disabled={isAnalyzing}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {rep ? "Re-analyze" : "Analyze quality"}
                </button>
                {rep && (
                  <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
                    {rep.summary}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/landlord/boost"
                    search={{ propertyId: p.id }}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    <TrendingUp className="h-3 w-3" /> Boost
                  </Link>
                  {p.is_active && (
                    <button
                      type="button"
                      disabled={markRented.isPending}
                      onClick={() => handleMarkRented(p.id, p.rent_kes)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Rented
                    </button>
                  )}
                </div>
                <PropertyMediaManager property={p} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Properties</h1>
        <Link
          to="/landlord/properties/new"
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
        >
          <Plus className="h-4 w-4" /> Add property
        </Link>
      </header>

      {renderPropertiesContent()}
    </div>
  );
}
