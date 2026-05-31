import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LandlordShell } from "@/components/LandlordShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatKes, prettyType, type Property } from "@/lib/properties";
import { Plus, Building2 } from "lucide-react";

export const Route = createFileRoute("/landlord/properties")({
  component: () => <LandlordShell><Page /></LandlordShell>,
});

function Page() {
  const { user } = useAuth();
  const { data: properties = [] } = useQuery({
    queryKey: ["my-properties-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("properties").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false });
      return (data ?? []) as Property[];
    },
  });

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Properties</h1>
        <Link to="/landlord/properties/new" className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background">
          <Plus className="h-4 w-4" /> Add property
        </Link>
      </header>

      {properties.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed bg-card p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-display text-lg font-semibold">No properties yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Add a property to start collecting leads.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-2xl border bg-card shadow-soft">
              <div className="aspect-[4/3] bg-muted">
                {p.images[0] && <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />}
              </div>
              <div className="p-4">
                <h3 className="line-clamp-1 font-display font-semibold">{p.title}</h3>
                <p className="text-xs text-muted-foreground">{p.neighborhood} · {prettyType(p.property_type)}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-semibold text-primary">{formatKes(p.rent_kes)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
