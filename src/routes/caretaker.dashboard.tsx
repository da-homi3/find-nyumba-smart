import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCaretakerAssignedProperties,
  updateCaretakerVacancy,
  validateCaretakerSession,
} from "@/lib/api/caretaker.functions";
import { getCaretakerToken, clearCaretakerToken } from "@/lib/caretaker-session";
import { Building2, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import type { Property } from "@/lib/properties";

export const Route = createFileRoute("/caretaker/dashboard")({
  head: () => ({ meta: [{ title: "Caretaker dashboard — NyumbaSearch" }] }),
  component: CaretakerDashboard,
});

function CaretakerDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const token = getCaretakerToken();

  useEffect(() => {
    if (!token) {
      navigate({ to: "/caretaker" });
      return;
    }
    validateCaretakerSession({ data: { token } }).catch(() => {
      clearCaretakerToken();
      navigate({ to: "/caretaker" });
    });
  }, [navigate, token]);

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["caretaker-properties", token],
    enabled: !!token,
    queryFn: async () => {
      const rows = await listCaretakerAssignedProperties({ data: { token: token! } });
      return rows as Property[];
    },
  });

  const toggleVacancy = useMutation({
    mutationFn: ({ propertyId, isVacant }: { propertyId: string; isVacant: boolean }) =>
      updateCaretakerVacancy({ data: { token: token!, propertyId, isVacant } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caretaker-properties"] });
      toast.success("Vacancy updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b bg-background px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <h1 className="font-display text-lg font-semibold">Caretaker dashboard</h1>
          <button
            type="button"
            onClick={() => {
              clearCaretakerToken();
              navigate({ to: "/caretaker" });
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-5 py-6">
        <p className="text-sm text-muted-foreground">
          Assigned properties only — you cannot change pricing or view analytics.
        </p>
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        ) : properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">No properties assigned yet.</p>
        ) : (
          properties.map((p) => {
            const isVacant = (p as Property & { is_vacant?: boolean }).is_vacant !== false;
            return (
              <div key={p.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  {p.images[0] ? (
                    <img src={p.images[0]} alt="" className="h-16 w-20 rounded-lg object-cover" />
                  ) : (
                    <div className="grid h-16 w-20 place-items-center rounded-lg bg-muted">
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.neighborhood}</p>
                    <span
                      className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isVacant
                          ? "bg-amber-500/15 text-amber-700"
                          : "bg-emerald-500/15 text-emerald-700"
                      }`}
                    >
                      {isVacant ? "Vacant" : "Occupied"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Mark as ${isVacant ? "occupied" : "vacant"}?`)) {
                      toggleVacancy.mutate({ propertyId: p.id, isVacant: !isVacant });
                    }
                  }}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                >
                  <ToggleLeft className="h-3.5 w-3.5" /> Toggle vacancy
                </button>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
