import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listLandlordLeads } from "@/lib/api/nyumba.functions";
import { formatKes } from "@/lib/properties";
import { ConversationThread } from "@/components/ConversationThread";
import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { ManagerShell } from "@/components/ManagerShell";
import { LeadPackUpgradeBanner } from "@/components/dashboard/portal/LeadPackUpgradeBanner";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";

export const Route = createFileRoute("/manager/leads")({
  validateSearch: (search: Record<string, unknown>) => ({
    thread: typeof search.thread === "string" ? search.thread : undefined,
  }),
  head: () => ({ meta: [{ title: "Leads — Property manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <ManagerLeadsPage />
    </ManagerShell>
  ),
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
      <div className="px-4 py-6 lg:px-10">
        <ConversationThread inquiryId={activeThread} onBack={closeThread} showQuickReplies />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Inbox
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold">
            <Inbox className="h-6 w-6" /> Leads
          </h1>
        </div>
        <DashboardSettingsLink variant="pill" />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {leads.length} inquiries across your managed portfolio
      </p>
      <LeadPackUpgradeBanner portal="manager" />
      <ManagerLeadsBody isLoading={isLoading} leads={leads} onOpenThread={openThread} />
    </div>
  );
}

function ManagerLeadsBody({
  isLoading,
  leads,
  onOpenThread,
}: Readonly<{
  isLoading: boolean;
  leads: Awaited<ReturnType<typeof listLandlordLeads>>;
  onOpenThread: (id: string) => void;
}>) {
  if (isLoading) {
    return <div className="mt-8 h-32 animate-pulse rounded-2xl bg-muted" />;
  }
  if (leads.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        No leads yet. Inquiries from tenants on your portfolio properties will appear here.
      </p>
    );
  }
  return (
    <div className="mt-8 grid gap-4">
      {leads.map((lead) => (
        <article key={lead.id} className="rounded-2xl border bg-card p-5">
          <p className="font-semibold">{lead.profiles?.full_name ?? "Tenant"}</p>
          <p className="text-sm text-muted-foreground">
            {lead.properties?.title} · {lead.properties ? formatKes(lead.properties.rent_kes) : ""}
          </p>
          <button
            type="button"
            onClick={() => onOpenThread(lead.id)}
            className="mt-3 text-sm font-semibold text-primary"
          >
            Open thread →
          </button>
        </article>
      ))}
    </div>
  );
}
