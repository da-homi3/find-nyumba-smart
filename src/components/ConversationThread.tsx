import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getInquiryThread,
  listInquiryMessages,
  markMessagesRead,
  sendInquiryMessage,
} from "@/lib/api/nyumba.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Check, CheckCheck, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

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

export function ConversationThread({
  inquiryId,
  onBack,
  showQuickReplies = false,
}: {
  inquiryId: string;
  onBack?: () => void;
  showQuickReplies?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  const { data: thread } = useQuery({
    queryKey: ["inquiry-thread", inquiryId],
    queryFn: () => getInquiryThread({ data: { inquiryId } }),
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["inquiry-messages", inquiryId],
    queryFn: () => listInquiryMessages({ data: { inquiryId } }),
  });

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
    onError: (err: Error) => toast.error(err.message),
  });

  const counterparty = thread?.counterparty;
  const inquiryProps = thread?.inquiry as { properties?: { title?: string } } | undefined;
  const propertyTitle = inquiryProps?.properties?.title ?? "Listing";

  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        {onBack && (
          <button type="button" onClick={onBack} className="text-sm font-medium text-primary">
            Back
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-1 font-display font-semibold">
            {counterparty?.full_name ?? "Conversation"}
          </h2>
          <p className="line-clamp-1 text-xs text-muted-foreground">{propertyTitle}</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
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

      {showQuickReplies && (
        <div className="flex flex-wrap gap-1.5 border-t px-3 pt-2">
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

      <form
        className="flex items-end gap-2 border-t p-3"
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
    </div>
  );
}
