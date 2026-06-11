import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2, Bell, Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PropertyCard } from "@/components/PropertyCard";
import { listSavedProperties, toggleSavedProperty } from "@/lib/api/nyumba.functions";
import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  updateSavedSearch,
} from "@/lib/api/search.functions";
import { useState } from "react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type SavedSearch = Database["public"]["Tables"]["saved_searches"]["Row"];
type AlertCriteria = {
  neighborhood?: string;
  propertyType?: string;
  maxBudget?: number;
  frequency?: string;
};

function formatAlertLabel(row: SavedSearch) {
  const c = (row.criteria ?? row.filters ?? {}) as AlertCriteria;
  const type =
    !c.propertyType || c.propertyType === "any" ? "Any type" : c.propertyType.replace("_", " ");
  const hood = c.neighborhood ?? "Any area";
  const budget = c.maxBudget ? `under KES ${c.maxBudget.toLocaleString()}` : "any budget";
  return `${type} in ${hood} ${budget}`;
}

export const Route = createFileRoute("/tenant/saved")({
  component: SavedPage,
});

function SavedPage() {
  const { user } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertForm, setAlertForm] = useState({
    neighborhood: "Kilimani",
    propertyType: "any",
    maxBudget: 40000,
    frequency: "daily" as "instant" | "daily" | "weekly",
  });

  const {
    data = [],
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["saved-properties", user?.id],
    enabled: !!user,
    queryFn: () => listSavedProperties(),
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["saved-searches", user?.id],
    enabled: !!user,
    queryFn: () => listSavedSearches(),
  });

  const unsave = useMutation({
    mutationFn: (propertyId: string) => toggleSavedProperty({ data: { propertyId, saved: false } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-properties"] });
      toast.success("Removed from saved");
    },
  });

  const createAlert = useMutation({
    mutationFn: () =>
      createSavedSearch({
        data: {
          name: `${alertForm.neighborhood} · KES ${alertForm.maxBudget.toLocaleString()}`,
          filters: alertForm,
          alertEnabled: true,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
      setShowAlertModal(false);
      toast.success("We'll email you when new listings match this search");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAlert = useMutation({
    mutationFn: ({ id, alertEnabled }: { id: string; alertEnabled: boolean }) =>
      updateSavedSearch({ data: { id, alertEnabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });

  const removeAlert = useMutation({
    mutationFn: (id: string) => deleteSavedSearch({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Save your favourites</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to save homes and pick up where you left off.
        </p>
        <Link
          to="/auth"
          search={{ redirect: location.pathname + location.search }}
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pt-10 pb-24">
      <h1 className="font-display text-2xl font-semibold">Saved homes</h1>
      <p className="text-sm text-muted-foreground">{data.length} properties</p>

      {isLoading ? (
        <div className="mt-10 flex items-center justify-center gap-2 rounded-2xl border p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading saved homes...
        </div>
      ) : error ? (
        <div className="mt-10 rounded-2xl border border-destructive/30 p-6 text-center">
          <p className="text-sm font-medium text-destructive">Saved homes did not load.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      ) : data.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed p-10 text-center">
          <Heart className="mx-auto h-14 w-14 text-muted-foreground/40" />
          <p className="mt-4 font-display text-lg font-semibold">You haven't saved any homes yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tap the heart on any listing to save it here.
          </p>
          <Link
            to="/tenant"
            className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.map((p) => (
            <div key={p.id} className="relative">
              <button
                type="button"
                onClick={() => unsave.mutate(p.id)}
                className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-background/95 shadow"
                aria-label="Remove from saved"
              >
                <X className="h-4 w-4" />
              </button>
              <PropertyCard p={p} showSave={false} />
            </div>
          ))}
        </div>
      )}

      <section className="mt-12 border-t pt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Bell className="h-5 w-5 text-primary" />
            Search alerts
          </h2>
          <button
            type="button"
            onClick={() => setShowAlertModal(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Create alert
          </button>
        </div>
        {alertsLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading alerts…</p>
        ) : alerts.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No alerts yet — get emailed when new listings match.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{formatAlertLabel(a)}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {((a.criteria ?? a.filters) as AlertCriteria).frequency ?? "daily"} alerts
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={a.alert_enabled}
                      onChange={(e) =>
                        toggleAlert.mutate({ id: a.id, alertEnabled: e.target.checked })
                      }
                    />
                    On
                  </label>
                  <button
                    type="button"
                    onClick={() => removeAlert.mutate(a.id)}
                    aria-label="Delete alert"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur">
          <form
            className="w-full max-w-sm rounded-2xl border bg-card p-6"
            onSubmit={(e) => {
              e.preventDefault();
              createAlert.mutate();
            }}
          >
            <h3 className="font-display text-lg font-semibold">Create search alert</h3>
            <label className="mt-4 block text-xs font-medium">
              Neighborhood
              <input
                value={alertForm.neighborhood}
                onChange={(e) => setAlertForm((f) => ({ ...f, neighborhood: e.target.value }))}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block text-xs font-medium">
              Max budget (KES)
              <input
                type="number"
                value={alertForm.maxBudget}
                onChange={(e) => setAlertForm((f) => ({ ...f, maxBudget: Number(e.target.value) }))}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block text-xs font-medium">
              Frequency
              <select
                value={alertForm.frequency}
                onChange={(e) =>
                  setAlertForm((f) => ({
                    ...f,
                    frequency: e.target.value as typeof alertForm.frequency,
                  }))
                }
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              >
                <option value="instant">Instant</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowAlertModal(false)}
                className="flex-1 rounded-xl border py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createAlert.isPending}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {createAlert.isPending ? "Saving…" : "Save alert"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
