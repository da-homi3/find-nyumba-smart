import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listLandlordLeads, updateInquiryStatus } from "@/lib/api/nyumba.functions";
import { formatKes } from "@/lib/properties";
import { ConversationThread } from "@/components/ConversationThread";
import { useEffect, useState } from "react";
import { Inbox, MessageCircle, Phone } from "lucide-react";
import { ManagerShell } from "@/components/ManagerShell";
import { LeadPackUpgradeBanner } from "@/components/dashboard/portal/LeadPackUpgradeBanner";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { useAuth } from "@/hooks/use-auth";
import { countUnread } from "@/lib/conversation-utils";
import { toast } from "sonner";

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

type LeadStatus = "new" | "contacted" | "viewing" | "closed" | "archived";

function ManagerLeadsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
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

  const statusMutation = useMutation({
    mutationFn: updateInquiryStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manager-leads-inbox"] });
      toast.success("Lead updated");
    },
    onError: (error: Error) => toast.error(error.message),
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
      <ManagerLeadsBody
        isLoading={isLoading}
        leads={leads}
        userId={user?.id}
        onOpenThread={openThread}
        onStatusChange={(payload) => statusMutation.mutate(payload)}
      />
    </div>
  );
}

function ManagerLeadsBody({
  isLoading,
  leads,
  userId,
  onOpenThread,
  onStatusChange,
}: Readonly<{
  isLoading: boolean;
  leads: Awaited<ReturnType<typeof listLandlordLeads>>;
  userId: string | undefined;
  onOpenThread: (id: string) => void;
  onStatusChange: (payload: { data: { inquiryId: string; status: LeadStatus } }) => void;
}>) {
  if (isLoading) {
    return <div className="mt-8 h-32 animate-pulse rounded-2xl bg-muted" />;
  }
  if (leads.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border-2 border-dashed bg-card p-12 text-center">
        <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">No leads yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-4">
      {leads.map((lead) => {
        const unread = countUnread(lead.inquiry_messages, userId);
        return (
          <article key={lead.id} className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{lead.profiles?.full_name ?? "Tenant"}</p>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">
                    {lead.status}
                  </span>
                  {unread > 0 ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                      {unread} new
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lead.properties?.title} ·{" "}
                  {lead.properties ? formatKes(lead.properties.rent_kes) : ""}
                </p>
              </div>
              <select
                value={lead.status}
                onChange={(event) =>
                  onStatusChange({
                    data: {
                      inquiryId: lead.id,
                      status: event.target.value as LeadStatus,
                    },
                  })
                }
                className="rounded-xl border bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="viewing">Viewing</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <p className="mt-4 rounded-xl bg-secondary p-3 text-sm">{lead.message}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {lead.profiles?.phone ? (
                <a
                  href={`tel:${lead.profiles.phone}`}
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-medium"
                >
                  <Phone className="h-3.5 w-3.5" /> {lead.profiles.phone}
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenThread(lead.id)}
                className="inline-flex items-center gap-1 rounded-full border bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Open thread
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
