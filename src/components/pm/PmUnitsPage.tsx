import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatKes } from "@/lib/properties";
import {
  createPmBuilding,
  createPmUnit,
  getPmProperty,
  publishPmUnitToMarketplace,
} from "@/lib/api/pm.functions";
import { PmPropertySubnav, type PmPortal } from "@/components/pm/pm-nav";

export function PmUnitsPage({
  portal,
  propertyId,
}: Readonly<{ portal: PmPortal; propertyId: string }>) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["pm-property", propertyId],
    queryFn: () => getPmProperty({ data: { propertyId } }),
  });

  const [buildingName, setBuildingName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [monthlyRent, setMonthlyRent] = useState(25000);
  const [unitType, setUnitType] = useState("1br");
  const [buildingId, setBuildingId] = useState<string>("");

  const addBuilding = useMutation({
    mutationFn: () =>
      createPmBuilding({ data: { propertyId, name: buildingName } }),
    onSuccess: () => {
      toast.success("Building added");
      setBuildingName("");
      qc.invalidateQueries({ queryKey: ["pm-property", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addUnit = useMutation({
    mutationFn: () =>
      createPmUnit({
        data: {
          propertyId,
          buildingId: buildingId || null,
          unitLabel,
          unitType: unitType as
            | "bedsitter"
            | "1br"
            | "2br"
            | "3br"
            | "4br+"
            | "commercial"
            | "other",
          monthlyRent,
        },
      }),
    onSuccess: () => {
      toast.success("Unit added");
      setUnitLabel("");
      qc.invalidateQueries({ queryKey: ["pm-property", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: (unitId: string) => publishPmUnitToMarketplace({ data: { unitId } }),
    onSuccess: (res) => {
      toast.success(`Published listing ${res.listingId.slice(0, 8)}…`);
      qc.invalidateQueries({ queryKey: ["pm-property", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!detail.data) return null;

  const { property, buildings, units } = detail.data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">{property.name} · Units</h1>
      <div className="mt-6">
        <PmPropertySubnav portal={portal} propertyId={propertyId} active="units" />
      </div>

      <section className="mb-8 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">Add building (optional)</h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addBuilding.mutate();
          }}
        >
          <input
            required
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
            placeholder="Block A"
            className="min-w-48 flex-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={addBuilding.isPending}
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background"
          >
            Add
          </button>
        </form>
        {buildings.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {buildings.map((b: { id: string; name: string }) => (
              <li key={b.id} className="rounded-md bg-muted px-2 py-1">
                {b.name}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mb-8 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">Add unit</h2>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            addUnit.mutate();
          }}
        >
          <input
            required
            value={unitLabel}
            onChange={(e) => setUnitLabel(e.target.value)}
            placeholder="Unit label (e.g. 4B)"
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <select
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            {["bedsitter", "1br", "2br", "3br", "4br+", "commercial", "other"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            required
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(Number(e.target.value))}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="">No building</option>
            {buildings.map((b: { id: string; name: string }) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={addUnit.isPending}
            className="sm:col-span-2 rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background"
          >
            Add unit
          </button>
        </form>
      </section>

      <ul className="space-y-2">
        {units.map(
          (u: {
            id: string;
            unit_label: string;
            unit_type: string | null;
            monthly_rent: number;
            status: string;
            linked_listing_id: string | null;
          }) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div>
                <div className="font-medium">
                  {u.unit_label}{" "}
                  <span className="text-sm text-muted-foreground">
                    · {u.unit_type ?? "unit"} · {formatKes(u.monthly_rent)}
                  </span>
                </div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {u.status}
                  {u.linked_listing_id ? " · listed" : ""}
                </div>
              </div>
              {u.status === "vacant" && !u.linked_listing_id ? (
                <button
                  type="button"
                  disabled={publish.isPending}
                  onClick={() => publish.mutate(u.id)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  Publish to marketplace
                </button>
              ) : null}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
