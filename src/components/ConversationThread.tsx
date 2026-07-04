import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getInquiryThread,
  listInquiryMessages,
  markMessagesRead,
  sendInquiryMessage,
} from "@/lib/api/nyumba.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Check, CheckCheck, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { PlusRequiredError } from "@/lib/payments/require-plus";
import { useEntitlements } from "@/hooks/use-entitlements";
import { whatsAppUrl } from "@/lib/phone";

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  read_at: string | null;
};

const LANDLORD_QUICK_REPLIES = [
  "Property is still available",
  "Please book a viewing",
  "Thanks for your interest",
];

function BackControl({ backTo, onBack }: Readonly<{ backTo?: string; onBack?: () => void }>) {
  if (backTo != null) {
    return (
      <Link to={backTo} className="text-sm font-medium text-primary">
        ← Back
      </Link>
    );
  }
  if (onBack) {
    return (
      <button type="button" onClick={onBack} className="text-sm font-medium text-primary">
        ← Back
      </button>
    );
  }
  return null;
}

type ConversationThreadProps = {
  inquiryId: string;
  /** Router path for the back link (preferred over onBack). */
  backTo?: string;
  onBack?: () => void;
  showQuickReplies?: boolean;
  /** Full-viewport chat (hides tenant bottom nav). */
  fullHeight?: boolean;
};

export function ConversationThread({
  inquiryId,
  backTo,
  onBack,
  showQuickReplies = false,
  fullHeight = false,
}: Readonly<ConversationThreadProps>) {
  const { user } = useAuth();
  const { isPlus } = useEntitlements();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  const {
    data: thread,
    error: threadError,
    isLoading: threadLoading,
  } = useQuery({
    queryKey: ["inquiry-thread", inquiryId],
    queryFn: () => getInquiryThread({ data: { inquiryId } }),
    retry: 1,
  });

  const {
    data: messages = [],
    isLoading: messagesLoading,
    error: messagesError,
  } = useQuery({
    queryKey: ["inquiry-messages", inquiryId],
    queryFn: () => listInquiryMessages({ data: { inquiryId } }),
    retry: 1,
  });

  const loadError = threadError ?? messagesError;
  const isLoading = threadLoading || messagesLoading;

  useEffect(() => {
    if (!inquiryId || !user) return;
    void markMessagesRead({ data: { inquiryId } }).then(() => {
      qc.invalidateQueries({ queryKey: ["tenant-inquiries"] });
      qc.invalidateQueries({ queryKey: ["landlord-leads"] });
    });
  }, [inquiryId, user, qc]);

  useEffect(() => {
    if (!inquiryId) return;
    const channel = supabase
      .channel(`inquiry-${inquiryId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inquiry_messages",
          filter: `inquiry_id=eq.${inquiryId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["inquiry-messages", inquiryId] });
          void markMessagesRead({ data: { inquiryId } });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "inquiry_messages",
          filter: `inquiry_id=eq.${inquiryId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["inquiry-messages", inquiryId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [inquiryId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: (body: string) => sendInquiryMessage({ data: { inquiryId, body } }),
    onSuccess: () => {
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["inquiry-messages", inquiryId] });
      void qc.invalidateQueries({ queryKey: ["tenant-inquiries"] });
      void qc.invalidateQueries({ queryKey: ["landlord-leads"] });
    },
    onError: (err: Error) => {
      if (err instanceof PlusRequiredError) {
        toast.error(err.message, { description: "Upgrade to Plus to message landlords." });
        return;
      }
      toast.error(err.message);
    },
  });

  const counterparty = thread?.counterparty;
  const inquiry = thread?.inquiry as
    | {
        tenant_id?: string;
        property_id?: string;
        properties?: { id?: string; title?: string } | null;
      }
    | undefined;
  const tenantNeedsPlus = inquiry?.tenant_id === user?.id && !isPlus;
  const propertyTitle = inquiry?.properties?.title ?? "Listing";
  const propertyId = inquiry?.property_id ?? inquiry?.properties?.id;
  const isTenantViewer = inquiry?.tenant_id === user?.id;
  const landlordPhone = counterparty?.phone?.trim() ?? null;
  const waLink =
    isTenantViewer && landlordPhone
      ? whatsAppUrl(
          landlordPhone,
          `Hi, I'm interested in ${propertyTitle} on NyumbaSearch. Can we continue our conversation here?`,
        )
      : null;

  if (loadError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-medium text-destructive">Could not load this conversation.</p>
        <p className="mt-1 text-xs text-muted-foreground">{loadError.message}</p>
        <BackControl backTo={backTo} onBack={onBack} />
      </div>
    );
  }

  return (
    <div
      className={
        fullHeight ? "flex h-dvh flex-col bg-background" : "flex h-full min-h-[60vh] flex-col"
      }
    >
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <BackControl backTo={backTo} onBack={onBack} />
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-1 font-display font-semibold">
            {counterparty?.full_name ?? "Conversation"}
          </h2>
          {propertyId ? (
            <Link
              to="/tenant/property/$id"
              params={{ id: propertyId }}
              className="line-clamp-1 text-xs text-primary hover:underline"
            >
              {propertyTitle}
            </Link>
          ) : (
            <p className="line-clamp-1 text-xs text-muted-foreground">{propertyTitle}</p>
          )}
        </div>
      </header>

      {waLink ? (
        <div className="shrink-0 border-b bg-secondary/40 px-4 py-3">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
          >
            <MessageCircle className="h-4 w-4" />
            Continue on WhatsApp
          </a>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Opens a chat with the landlord for faster replies.
          </p>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          (messages as Message[]).map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <div
                    className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                      mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {mine &&
                      (m.read_at ? (
                        <CheckCheck className="h-3 w-3" aria-label="Read" />
                      ) : (
                        <Check className="h-3 w-3" aria-label="Sent" />
                      ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {showQuickReplies && !tenantNeedsPlus && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-t px-3 pt-2">
          {LANDLORD_QUICK_REPLIES.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => send.mutate(text)}
              className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium"
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {tenantNeedsPlus ? (
        <div className="shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-muted-foreground">
          Messaging requires{" "}
          <Link
            to="/tenant/checkout"
            search={{ plan: "plus" }}
            className="font-semibold text-primary"
          >
            NyumbaSearch Plus
          </Link>
        </div>
      ) : (
        <form
          className="flex shrink-0 items-end gap-2 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            const body = draft.trim();
            if (!body || send.isPending) return;
            send.mutate(body);
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Type a message…"
            className="min-h-[44px] flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={!draft.trim() || send.isPending}
            className="rounded-xl bg-primary p-3 text-primary-foreground disabled:opacity-50"
            aria-label="Send message"
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      )}
    </div>
  );
}
