import { Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import type { TenantFilters } from "@/components/TenantFiltersBar";
import { createSavedSearch } from "@/lib/api/search.functions";
import {
  hasAlertableCriteria,
  savedSearchDisplayName,
  tenantFiltersToSavedCriteria,
} from "@/lib/search/saved-search-criteria";
import { errorMessage } from "@/lib/utils";

type Props = Readonly<{
  filters: TenantFilters;
  className?: string;
}>;

export function SaveSearchAlertButton({ filters, className = "" }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const criteria = tenantFiltersToSavedCriteria(filters);
      if (!hasAlertableCriteria(criteria)) {
        throw new Error("Set an area, budget, or home type first — then save this search.");
      }
      return createSavedSearch({
        data: {
          name: savedSearchDisplayName(criteria),
          filters: criteria as Record<string, unknown>,
          alertEnabled: true,
        },
      });
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["saved-searches"] });
      toast.success(`Alert on: ${row.name}`, {
        description: "We’ll email you when matching homes go live.",
        action: {
          label: "Manage",
          onClick: () => {
            void navigate({ to: "/tenant/saved" });
          },
        },
      });
    },
    onError: (err: Error) => toast.error(errorMessage(err)),
  });

  function onClick() {
    if (!user) {
      toast.error("Sign in to get alerts for this search");
      void navigate({ to: "/auth", search: { redirect: "/tenant", mode: "signin" } });
      return;
    }
    save.mutate();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={save.isPending}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary disabled:opacity-60 ${className}`}
      data-tour="save-search-alert"
    >
      <Bell className="h-4 w-4 text-primary" aria-hidden />
      {save.isPending ? "Saving…" : "Alert me on this search"}
    </button>
  );
}
