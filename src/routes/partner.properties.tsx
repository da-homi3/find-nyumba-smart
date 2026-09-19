import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PartnerShell } from "@/components/partner/PartnerShell";
import { useActivePilotId, usePilotDetail } from "@/hooks/use-partner-pilot";
import { addPilotProperty } from "@/lib/api/pilot-partnership.functions";
import { formatKes } from "@/lib/properties";

export const Route = createFileRoute("/partner/properties")({
  head: () => ({ meta: [{ title: "Pilot properties — NyumbaSearch" }] }),
  component: () => (
    <PartnerShell>
      <PartnerPropertiesPage />
    </PartnerShell>
  ),
});

function PartnerPropertiesPage() {
  const qc = useQueryClient();
  const { pilotId } = useActivePilotId();
  const { data, isLoading } = usePilotDetail(pilotId);
  const [propertyId, setPropertyId] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!pilotId) throw new Error("No pilot selected");
      const id = propertyId.trim();
      if (!id) throw new Error("Enter a property UUID");
      return addPilotProperty({ data: { pilotId, propertyId: id } });
    },
    onSuccess: () => {
      toast.success("Property added to pilot — live now");
      setPropertyId("");
      void qc.invalidateQueries({ queryKey: ["pilot-detail", pilotId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const properties = data?.properties ?? [];

  return (
    <div className="px-6 py-8 pb-20 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Pilot properties</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Link existing listings to this pilot, or create a new listing first. Owned listings go
            live on the pilot immediately.
          </p>
        </div>
        <Link
          to="/landlord/properties/new"
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
        >
          <Plus className="h-4 w-4" /> Create listing
        </Link>
      </header>

      <form
        className="mt-8 flex flex-col gap-3 rounded-xl border bg-card p-5 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <label className="min-w-0 flex-1 text-sm font-medium">
          Existing property UUID
          <input
            type="text"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 font-mono text-sm outline-none focus:border-primary/50"
          />
        </label>
        <button
          type="submit"
          disabled={add.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
        >
          {add.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          Add to pilot
        </button>
      </form>

      {isLoading ? (
        <div className="mt-8 flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : properties.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No properties in this pilot yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a listing, then paste its UUID here to include it in the pilot.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {properties.map((row) => {
            const prop = row.properties as {
              id?: string;
              title?: string;
              neighborhood?: string | null;
              rent_kes?: number | null;
              property_type?: string | null;
              is_active?: boolean | null;
            } | null;
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{prop?.title ?? "Property"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[
                      prop?.neighborhood,
                      prop?.property_type,
                      prop?.rent_kes != null ? formatKes(prop.rent_kes) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {row.property_id}
                  </p>
                </div>
                <span className="rounded-full border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                  {row.status.replaceAll("_", " ")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
