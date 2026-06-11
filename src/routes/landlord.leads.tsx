import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LandlordShell } from "@/components/LandlordShell";
import { ConversationThread } from "@/components/ConversationThread";
import { countUnread } from "@/lib/conversation-utils";
import { listLandlordLeads, updateInquiryStatus } from "@/lib/api/nyumba.functions";
import { formatKes } from "@/lib/properties";
import { useAuth } from "@/hooks/use-auth";
import { Inbox, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/landlord/leads")({
  validateSearch: (search: Record<string, unknown>) => ({
    thread: typeof search.thread === "string" ? search.thread : undefined,
  }),
  component: () => (
    <LandlordShell>
      <LeadsPage />
    </LandlordShell>
  ),
});

function LeadsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { thread: threadFromUrl } = Route.useSearch();
  const [activeThread, setActiveThread] = useState<string | undefined>(threadFromUrl);

  useEffect(() => {
    setActiveThread(threadFromUrl);
  }, [threadFromUrl]);

  const openThread = (id: string) => {
    setActiveThread(id);
    navigate({ to: "/landlord/leads", search: { thread: id } });
  };

  const closeThread = () => {
    setActiveThread(undefined);
    navigate({ to: "/landlord/leads", search: { thread: undefined } });
  };

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["landlord-leads", user?.id],
    enabled: !!user,
    queryFn: () => listLandlordLeads(),
  });

  const statusMutation = useMutation({
    mutationFn: updateInquiryStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landlord-leads"] });
      qc.invalidateQueries({ queryKey: ["landlord-dashboard"] });
      toast.success("Lead updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (activeThread) {
    return (
      <div className="px-4 py-6 lg:px-10">
        <ConversationThread inquiryId={activeThread} onBack={closeThread} showQuickReplies />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenant inquiries, contact info, and follow-up status.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
          {leads.length} total
        </span>
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed bg-card p-12 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No leads yet. Tenant inquiries land here in real time.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {leads.map((lead) => {
            const unread = countUnread(lead.inquiry_messages, user?.id);
            return (
              <article key={lead.id} className="rounded-2xl border bg-card p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-semibold">
                        {lead.profiles?.full_name ?? "Tenant"}
                      </h2>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">
                        {lead.status}
                      </span>
                      {unread > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                          {unread} new
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {lead.properties?.title ?? "Listing"} -{" "}
                      {lead.properties ? formatKes(lead.properties.rent_kes) : "Rent unavailable"}
                    </p>
                  </div>
                  <select
                    value={lead.status}
                    onChange={(event) =>
                      statusMutation.mutate({
                        data: {
                          inquiryId: lead.id,
                          status: event.target.value as
                            | "new"
                            | "contacted"
                            | "viewing"
                            | "closed"
                            | "archived",
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

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {lead.profiles?.phone && (
                    <a
                      href={`tel:${lead.profiles.phone}`}
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-medium text-foreground"
                    >
                      <Phone className="h-3.5 w-3.5" /> {lead.profiles.phone}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => openThread(lead.id)}
                    className="inline-flex items-center gap-1 rounded-full border bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Open thread ({lead.inquiry_messages?.length ?? 1})
                  </button>
                  <span className="rounded-full border px-3 py-1.5">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
