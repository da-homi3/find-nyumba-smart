import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { useQuery } from "@tanstack/react-query";
import { listLandlordLeads } from "@/lib/api/nyumba.functions";
import { formatKes } from "@/lib/properties";
import { ConversationThread } from "@/components/ConversationThread";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/agency/leads")({
  validateSearch: (search: Record<string, unknown>) => ({
    thread: typeof search.thread === "string" ? search.thread : undefined,
  }),
  component: () => (
    <AgencyShell>
      <Page />
    </AgencyShell>
  ),
});

function Page() {
  const navigate = useNavigate();
  const { thread: threadFromUrl } = Route.useSearch();
  const [activeThread, setActiveThread] = useState<string | undefined>(threadFromUrl);

  useEffect(() => {
    setActiveThread(threadFromUrl);
  }, [threadFromUrl]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["agency-leads"],
    queryFn: () => listLandlordLeads(),
  });

  const openThread = (id: string) => {
    setActiveThread(id);
    navigate({ to: "/agency/leads", search: { thread: id } });
  };

  const closeThread = () => {
    setActiveThread(undefined);
    navigate({ to: "/agency/leads", search: { thread: undefined } });
  };

  if (activeThread) {
    return (
      <div className="px-4 py-6 lg:px-10">
        <ConversationThread inquiryId={activeThread} onBack={closeThread} showQuickReplies />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <h1 className="font-display text-3xl font-semibold">Agency leads</h1>
      <p className="text-sm text-muted-foreground">{leads.length} inquiries across portfolio</p>
      {isLoading ? (
        <div className="mt-8 h-32 animate-pulse rounded-2xl bg-muted" />
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
    </div>
  );
}
