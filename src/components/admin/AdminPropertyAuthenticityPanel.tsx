import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adjustAdminPropertyAuthenticityScore } from "@/lib/api/admin.functions";
import { isDemoListingId } from "@/data/mockListings";
import { useAuth } from "@/hooks/use-auth";
import type { Property } from "@/lib/properties";
import { AdminPropertyAuthenticityControls } from "@/components/admin/AdminPropertyAuthenticityControls";
import { toast } from "sonner";

export function AdminPropertyAuthenticityPanel({ property }: Readonly<{ property: Property }>) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ propertyId, delta }: { propertyId: string; delta: number }) =>
      adjustAdminPropertyAuthenticityScore({
        data: { propertyId, delta },
      }),
    onSuccess: (row) => {
      toast.success(`Authenticity score set to ${row.authenticity_score}%`);
      void qc.invalidateQueries({ queryKey: ["property", property.id] });
      void qc.invalidateQueries({ queryKey: ["admin-properties"] });
      void qc.invalidateQueries({ queryKey: ["admin-audits"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isAdmin || isDemoListingId(property.id)) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
      <div className="text-xs">
        <p className="font-semibold text-primary">Admin: authenticity score</p>
        <p className="text-muted-foreground">
          Adjust trust score shown on cards and search ranking.
        </p>
      </div>
      <AdminPropertyAuthenticityControls
        propertyId={property.id}
        score={property.authenticity_score ?? 70}
        adjustScore={mutation}
        compact
      />
    </div>
  );
}
