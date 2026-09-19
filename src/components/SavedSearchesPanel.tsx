import { Bell, BellOff, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  deleteSavedSearch,
  listSavedSearches,
  updateSavedSearch,
} from "@/lib/api/search.functions";
import {
  savedCriteriaToTenantSearch,
  type SavedSearchCriteria,
} from "@/lib/search/saved-search-criteria";
import { errorMessage } from "@/lib/utils";

export function SavedSearchesPanel({ userId }: Readonly<{ userId: string }>) {
  const qc = useQueryClient();
  const { data: searches = [], isLoading } = useQuery({
    queryKey: ["saved-searches", userId],
    queryFn: () => listSavedSearches(),
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; alertEnabled: boolean }) =>
      updateSavedSearch({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["saved-searches"] });
      toast.success("Alert updated");
    },
    onError: (err: Error) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSavedSearch({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["saved-searches"] });
      toast.success("Search removed");
    },
    onError: (err: Error) => toast.error(errorMessage(err)),
  });

  if (isLoading) {
    return <div className="mt-4 h-24 animate-pulse rounded-2xl bg-muted" />;
  }

  if (searches.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-card/40 px-4 py-5 text-sm text-muted-foreground">
        No search alerts yet. On Browse, set filters and tap{" "}
        <span className="font-semibold text-foreground">Alert me on this search</span>.
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {searches.map((search) => {
        const criteria = (search.criteria ?? search.filters ?? {}) as SavedSearchCriteria;
        const browse = savedCriteriaToTenantSearch(criteria);
        return (
          <li
            key={search.id}
            className="flex items-start gap-3 rounded-2xl border bg-card px-4 py-3 shadow-soft"
          >
            <div className="min-w-0 flex-1">
              <Link
                to="/tenant"
                search={browse}
                className="font-semibold text-foreground hover:underline"
              >
                {search.name}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {search.alert_enabled ? "Alerts on" : "Alerts paused"}
                {criteria.neighborhood ? ` · ${criteria.neighborhood}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label={search.alert_enabled ? "Pause alerts" : "Enable alerts"}
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ id: search.id, alertEnabled: !search.alert_enabled })}
            >
              {search.alert_enabled ? (
                <Bell className="h-4 w-4 text-primary" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
              aria-label="Delete saved search"
              disabled={remove.isPending}
              onClick={() => remove.mutate(search.id)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
