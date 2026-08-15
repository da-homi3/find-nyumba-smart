import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setAdminPropertyActive } from "@/lib/api/admin.functions";
import { useAuth } from "@/hooks/use-auth";
import type { Property } from "@/lib/properties";

function DeleteButtonIcon({
  pending,
  isActive,
}: Readonly<{ pending: boolean; isActive: boolean }>) {
  if (pending) return <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />;
  if (isActive) return <Trash2 className="h-3.5 w-3.5" aria-hidden />;
  return <RotateCcw className="h-3.5 w-3.5" aria-hidden />;
}

/** Soft-delete / restore listing from the public property detail page (admins only). */
export function AdminPropertyDeleteButton({ property }: Readonly<{ property: Property }>) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (isActive: boolean) =>
      setAdminPropertyActive({ data: { propertyId: property.id, isActive } }),
    onSuccess: (row) => {
      const active = row.is_active;
      toast.success(active ? "Listing restored to the market" : "Listing removed from the market");
      void qc.invalidateQueries({ queryKey: ["property", property.id] });
      void qc.invalidateQueries({ queryKey: ["admin-properties"] });
      void qc.invalidateQueries({ queryKey: ["admin-audits"] });
      void qc.invalidateQueries({ queryKey: ["properties"] });
      if (!active) {
        void navigate({ to: "/admin", search: { tab: "properties" } });
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isAdmin) return null;

  const pending = mutation.isPending;
  const isActive = property.is_active;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (isActive) {
          const ok = globalThis.confirm(
            `Remove “${property.title}” from the market? Tenants will no longer see this listing.`,
          );
          if (!ok) return;
          mutation.mutate(false);
          return;
        }
        mutation.mutate(true);
      }}
      className={
        isActive
          ? "inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
          : "inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
      }
    >
      <DeleteButtonIcon pending={pending} isActive={isActive} />
      {isActive ? "Delete listing" : "Restore listing"}
    </button>
  );
}
