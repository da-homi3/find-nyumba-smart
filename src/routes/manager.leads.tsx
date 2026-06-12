import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listLandlordLeads } from "@/lib/api/nyumba.functions";
import { formatKes } from "@/lib/properties";
import { ConversationThread } from "@/components/ConversationThread";
import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";

export const Route = createFileRoute("/manager/leads")({
  validateSearch: (search: Record<string, unknown>) => ({
    thread: typeof search.thread === "string" ? search.thread : undefined,
  }),
  head: () => ({ meta: [{ title: "Leads — Property manager — NyumbaSearch" }] }),
  component: ManagerLeadsPage,
});

function ManagerLeadsPage() {
  const navigate = useNavigate();
  const { thread: threadFromUrl } = Route.useSearch();
  const [activeThread, setActiveThread] = useState<string | undefined>(threadFromUrl);

  useEffect(() => {
    setActiveThread(threadFromUrl);
  }, [threadFromUrl]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["manager-leads-inbox"],
    queryFn: () => listLandlordLeads(),
  });

  const openThread = (id: string) => {
    setActiveThread(id);
    navigate({ to: "/manager/leads", search: { thread: id } });
  };

  const closeThread = () => {
    setActiveThread(undefined);
    navigate({ to: "/manager/leads", search: { thread: undefined } });
  };

  if (activeThread) {
    return (
      <div className="min-h-screen bg-secondary px-4 py-6">
        <ConversationThread inquiryId={activeThread} onBack={closeThread} showQuickReplies />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b bg-foreground px-5 py-4 text-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-background/60">
              Property manager
            </p>
            <h1 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Inbox className="h-5 w-5" /> Leads inbox
            </h1>
          </div>
          <Link to="/manager/dashboard" className="text-sm text-gold">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <p className="text-sm text-muted-foreground">
          {leads.length} inquiries across your managed portfolio
        </p>
        {isLoading ? (
          <div className="mt-8 h-32 animate-pulse rounded-2xl bg-muted" />
        ) : leads.length === 0 ? (
          <p className="mt-8 rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No leads yet. Inquiries from tenants on your portfolio properties will appear here.
          </p>
        ) : (
          <div className="mt-8 grid gap-4">
            {leads.map((lead) => (
              <article key={lead.id} className="rounded-2xl border bg-card p-5">
                <p className="font-semibold">{lead.profiles?.full_name ?? "Tenant"}</p>
                <p className="text-sm text-muted-foreground">
                  {lead.properties?.title} ·{" "}
                  {lead.properties ? formatKes(lead.properties.rent_kes) : ""}
                </p>
                <button
                  type="button"
                  onClick={() => openThread(lead.id)}
                  className="mt-3 text-sm font-semibold text-primary"
                >
                  Open thread →
                </button>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
