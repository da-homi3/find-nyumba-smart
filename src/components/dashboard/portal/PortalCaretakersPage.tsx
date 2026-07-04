import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createCaretaker,
  listCaretakers,
  regenerateCaretakerPin,
  revokeCaretaker,
} from "@/lib/api/caretaker.functions";
import {
  listAgencyProperties,
  listLandlordProperties,
  listManagerProperties,
} from "@/lib/api/nyumba.functions";
import type { ListingPortal } from "@/lib/portal-paths";
import { KeyRound, Plus, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

async function listPortalProperties(portal: ListingPortal) {
  if (portal === "manager") return listManagerProperties();
  if (portal === "agency") return listAgencyProperties();
  return listLandlordProperties();
}

export function PortalCaretakersPage({ portal }: Readonly<{ portal: ListingPortal }>) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);

  const { data: caretakers = [], isLoading } = useQuery({
    queryKey: [`${portal}-caretakers`],
    queryFn: () => listCaretakers(),
  });

  const { data: properties = [] } = useQuery({
    queryKey: [`${portal}-properties-caretaker`],
    queryFn: () => listPortalProperties(portal),
  });

  const create = useMutation({
    mutationFn: () =>
      createCaretaker({
        data: { fullName, phone, propertyIds },
      }),
    onSuccess: (res) => {
      setRevealedPin(res.pin);
      setShowForm(false);
      setFullName("");
      setPhone("");
      setPropertyIds([]);
      void qc.invalidateQueries({ queryKey: [`${portal}-caretakers`] });
      toast.success("Caretaker created — share the PIN once");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regen = useMutation({
    mutationFn: (caretakerId: string) => regenerateCaretakerPin({ data: { caretakerId } }),
    onSuccess: (res) => {
      setRevealedPin(res.pin);
      toast.success("New PIN generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (caretakerId: string) => revokeCaretaker({ data: { caretakerId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [`${portal}-caretakers`] });
      toast.success("Caretaker access revoked");
    },
  });

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Caretakers</h1>
          <p className="text-sm text-muted-foreground">
            Generate PINs for on-site caretakers — they only see assigned properties.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add caretaker
        </button>
      </div>

      {revealedPin && (
        <div className="mt-6 rounded-2xl border-2 border-primary bg-primary/5 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4" /> Caretaker PIN (shown once)
          </p>
          <p className="mt-2 font-mono text-3xl tracking-widest">{revealedPin}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(revealedPin);
              toast.success("Copied");
            }}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            <Copy className="h-3 w-3" /> Copy PIN
          </button>
        </div>
      )}

      {showForm && (
        <form
          className="mt-6 space-y-4 rounded-2xl border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (propertyIds.length === 0) {
              toast.error("Select at least one property");
              return;
            }
            create.mutate();
          }}
        >
          <label className="block text-sm">
            Full name
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Phone (caretaker signs in with this + PIN)
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2"
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">Assigned properties</legend>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {properties.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={propertyIds.includes(p.id)}
                    onChange={(e) =>
                      setPropertyIds((ids) =>
                        e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id),
                      )
                    }
                  />
                  {p.title} · {p.neighborhood}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {create.isPending ? "Creating…" : "Generate PIN & create"}
          </button>
        </form>
      )}

      {isLoading ? (
        <Loader2 className="mt-10 h-6 w-6 animate-spin text-muted-foreground" />
      ) : (
        <div className="mt-8 space-y-3">
          {caretakers.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4"
            >
              <div>
                <p className="font-semibold">{c.full_name}</p>
                <p className="text-xs text-muted-foreground">{c.phone}</p>
                <p className="text-xs text-muted-foreground">
                  {(c.caretaker_property_assignments as { property_id: string }[] | null)?.length ??
                    0}{" "}
                  properties · {c.is_active ? "Active" : "Revoked"}
                </p>
              </div>
              <div className="flex gap-2">
                {c.is_active && (
                  <button
                    type="button"
                    onClick={() => regen.mutate(c.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                  >
                    New PIN
                  </button>
                )}
                {c.is_active && (
                  <button
                    type="button"
                    onClick={() => revoke.mutate(c.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-destructive"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
          {caretakers.length === 0 && (
            <p className="text-sm text-muted-foreground">No caretakers yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
