import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  addAdminLocationAlias,
  getAdminLocationOverview,
  listAdminLocations,
  removeAdminLocationAlias,
  setAdminLocationActive,
} from "@/lib/api/admin-locations.functions";
import { MapPin, Search, AlertTriangle } from "lucide-react";

export function AdminLocationsTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [aliasDraft, setAliasDraft] = useState<Record<string, string>>({});

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["admin-location-overview"],
    queryFn: () => getAdminLocationOverview(),
  });

  const { data: locations = [], isLoading: listLoading } = useQuery({
    queryKey: ["admin-locations", q, type],
    queryFn: () =>
      listAdminLocations({
        data: { q: q.trim() || undefined, type: type || undefined, limit: 60 },
      }),
  });

  const addAlias = useMutation({
    mutationFn: (payload: { locationId: string; alias: string }) =>
      addAdminLocationAlias({ data: payload }),
    onSuccess: () => {
      toast.success("Alias added");
      qc.invalidateQueries({ queryKey: ["admin-locations"] });
      qc.invalidateQueries({ queryKey: ["admin-location-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAlias = useMutation({
    mutationFn: (payload: { locationId: string; alias: string }) =>
      removeAdminLocationAlias({ data: payload }),
    onSuccess: () => {
      toast.success("Alias removed");
      qc.invalidateQueries({ queryKey: ["admin-locations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (payload: { locationId: string; isActive: boolean }) =>
      setAdminLocationActive({ data: payload }),
    onSuccess: () => {
      toast.success("Location updated");
      qc.invalidateQueries({ queryKey: ["admin-locations"] });
      qc.invalidateQueries({ queryKey: ["admin-location-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Counties", value: overview?.counts.COUNTY ?? "—" },
          { label: "Wards", value: overview?.counts.WARD ?? "—" },
          { label: "Needs review", value: overview?.needsReview ?? "—" },
          { label: "Unmatched listings", value: overview?.unmatched ?? "—" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-2 font-display text-2xl font-semibold">
              {overviewLoading ? "…" : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Search className="h-4 w-4 text-primary" /> Location demand (30d)
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Place</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Inventory</th>
                <th className="py-2 pr-3 font-medium">Searches</th>
                <th className="py-2 pr-3 font-medium">Views</th>
                <th className="py-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.demand ?? []).slice(0, 15).map((row) => (
                <tr key={row.locationId ?? row.name} className="border-t">
                  <td className="py-2 pr-3 font-medium">{row.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{row.type}</td>
                  <td className="py-2 pr-3">{row.inventoryCount}</td>
                  <td className="py-2 pr-3">{row.searchCount}</td>
                  <td className="py-2 pr-3">{row.viewCount}</td>
                  <td className="py-2">{row.demandScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!overviewLoading && (overview?.demand?.length ?? 0) === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No demand signals yet.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Popular location queries</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(overview?.popularQueries ?? []).map((item) => (
            <span
              key={item.query}
              className="rounded-full border bg-secondary/40 px-2.5 py-1 text-[11px]"
            >
              {item.query} · {item.count}
            </span>
          ))}
          {!overviewLoading && (overview?.popularQueries?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No autocomplete telemetry yet.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">Search places</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kilimani, Kangemi…"
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="NEIGHBOURHOOD">Neighbourhood</option>
              <option value="LOCALITY">Locality</option>
              <option value="WARD">Ward</option>
              <option value="CONSTITUENCY">Constituency</option>
              <option value="COUNTY">County</option>
              <option value="ROAD">Road</option>
            </select>
          </label>
        </div>

        <div className="mt-4 space-y-3">
          {listLoading ? (
            <p className="text-sm text-muted-foreground">Loading locations…</p>
          ) : null}
          {locations.map((loc) => (
            <div key={loc.id as string} className="rounded-xl border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {String(loc.name)}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {String(loc.location_type)}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    inventory {Number(loc.inventory_count ?? 0)} · confidence{" "}
                    {Number(loc.confidence_score ?? 0)} · {String(loc.source)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold"
                  onClick={() =>
                    toggleActive.mutate({
                      locationId: loc.id as string,
                      isActive: !Boolean(loc.is_active),
                    })
                  }
                >
                  {loc.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(loc.aliases as Array<{ alias: string; kind: string }>).map((a) => (
                  <button
                    key={a.alias}
                    type="button"
                    title="Remove alias"
                    className="rounded-full border px-2 py-0.5 text-[10px] hover:border-destructive hover:text-destructive"
                    onClick={() =>
                      removeAlias.mutate({ locationId: loc.id as string, alias: a.alias })
                    }
                  >
                    {a.alias}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={aliasDraft[loc.id as string] ?? ""}
                  onChange={(e) =>
                    setAliasDraft((prev) => ({ ...prev, [loc.id as string]: e.target.value }))
                  }
                  placeholder="Add alias…"
                  className="min-w-[180px] flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  onClick={() => {
                    const alias = (aliasDraft[loc.id as string] ?? "").trim();
                    if (!alias) return;
                    addAlias.mutate({ locationId: loc.id as string, alias });
                    setAliasDraft((prev) => ({ ...prev, [loc.id as string]: "" }));
                  }}
                >
                  Add alias
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> Recent location audit
        </h3>
        <ul className="mt-3 space-y-2 text-xs">
          {(overview?.recentAudit ?? []).map((evt) => (
            <li key={evt.id as string} className="border-t pt-2 text-muted-foreground">
              <span className="font-medium text-foreground">{String(evt.action)}</span> ·{" "}
              {new Date(String(evt.created_at)).toLocaleString()} ·{" "}
              {JSON.stringify(evt.details ?? {})}
            </li>
          ))}
          {!overviewLoading && (overview?.recentAudit?.length ?? 0) === 0 ? (
            <li className="text-muted-foreground">No audit events yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
