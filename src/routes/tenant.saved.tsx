import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { PropertyCard } from "@/components/PropertyCard";
import type { Property } from "@/lib/properties";

export const Route = createFileRoute("/tenant/saved")({
  component: SavedPage,
});

function SavedPage() {
  const { user } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ["saved-properties", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("saved_properties")
        .select("properties(*)")
        .eq("user_id", user!.id);
      return (data ?? []).map((r) => r.properties as unknown as Property).filter(Boolean);
    },
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Save your favourites</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to save homes and pick up where you left off.</p>
        <Link to="/auth" className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pt-10">
      <h1 className="font-display text-2xl font-semibold">Saved homes</h1>
      <p className="text-sm text-muted-foreground">{data.length} properties</p>
      {data.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          You haven't saved anything yet.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.map((p) => <PropertyCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
