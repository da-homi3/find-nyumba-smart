import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PropertyCard } from "@/components/PropertyCard";
import { listSavedProperties } from "@/lib/api/nyumba.functions";

export const Route = createFileRoute("/tenant/saved")({
  component: SavedPage,
});

function SavedPage() {
  const { user } = useAuth();
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
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pt-10">
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
          <p className="mt-1 text-xs text-muted-foreground">{(error as Error).message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      ) : data.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          You haven't saved anything yet.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.map((p) => (
            <PropertyCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
