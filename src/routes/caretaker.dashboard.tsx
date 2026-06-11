import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProperties } from "@/lib/properties";
import { caretakerSignOut, isCaretakerSignedIn } from "./caretaker.index";
import { Building2, ToggleLeft, Camera, Calendar, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/caretaker/dashboard")({
  head: () => ({ meta: [{ title: "Caretaker dashboard — NyumbaSearch" }] }),
  component: CaretakerDashboard,
});

const QUICK_REPLIES = [
  "Property is still available",
  "Please book a viewing",
  "Thanks for your interest",
];

function CaretakerDashboard() {
  const navigate = useNavigate();
  const [vacant, setVacant] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isCaretakerSignedIn()) navigate({ to: "/caretaker" });
  }, [navigate]);

  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: () => fetchProperties(),
  });

  const managed = properties.slice(0, 4);

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b bg-background px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <h1 className="font-display text-lg font-semibold">Caretaker dashboard</h1>
          <button
            type="button"
            onClick={() => {
              caretakerSignOut();
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
          You can update vacancy status and respond to tenants — no pricing or analytics access.
        </p>
        {managed.map((p) => {
          const isVacant = vacant[p.id] ?? true;
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
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Mark as ${isVacant ? "occupied" : "vacant"}?`)) {
                      setVacant((v) => ({ ...v, [p.id]: !isVacant }));
                      toast.success("Status updated");
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                >
                  <ToggleLeft className="h-3.5 w-3.5" /> Toggle vacancy
                </button>
                <button
                  type="button"
                  onClick={() => toast.success("Photo upload recorded (mock)")}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                >
                  <Camera className="h-3.5 w-3.5" /> Building update
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                >
                  <Calendar className="h-3.5 w-3.5" /> Viewings
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {QUICK_REPLIES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toast.success(`Sent: "${r}"`)}
                    className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium"
                  >
                    <MessageCircle className="mr-0.5 inline h-3 w-3" />
                    {r}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
