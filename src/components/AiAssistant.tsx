import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getAssistantReply } from "@/lib/api/ai.functions";
import { listSavedProperties } from "@/lib/api/nyumba.functions";
import { useAuth } from "@/hooks/use-auth";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";

type Turn = { role: "user" | "assistant"; text: string };

const QUICK = [
  { label: "Recommend homes", message: "Recommend properties for my budget" },
  { label: "Compare saved", message: "Compare my saved listings" },
  { label: "Best neighborhoods", message: "Which Nairobi neighborhoods should I consider?" },
  { label: "Scam check", message: "What are common rental scam red flags in Nairobi?" },
];

export function AiAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);

  const { data: saved = [] } = useQuery({
    queryKey: ["saved-for-ai", user?.id],
    enabled: !!user && open,
    queryFn: () => listSavedProperties(),
  });

  const ask = useMutation({
    mutationFn: (message: string) => {
      const propertyIds = saved.slice(0, 4).map((s) => s.id);
      return getAssistantReply({
        data: {
          message,
          propertyIds: /compare/i.test(message) ? propertyIds : undefined,
        },
      });
    },
    onSuccess: (res) => {
      setTurns((t) => [...t, { role: "assistant", text: res.reply }]);
    },
    onError: (err: Error) => {
      setTurns((t) => [...t, { role: "assistant", text: err.message }]);
    },
  });

  function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || ask.isPending) return;
    if (!user) {
      setTurns((t) => [...t, { role: "assistant", text: "Sign in to use the AI assistant." }]);
      return;
    }
    setTurns((t) => [...t, { role: "user", text: trimmed }]);
    setInput("");
    ask.mutate(trimmed);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-gold text-gold-foreground shadow-elegant"
        aria-label="Open AI assistant"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-40 right-4 z-40 flex h-[min(70vh,520px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border bg-card shadow-elegant">
          <header className="flex items-center gap-2 border-b bg-primary px-4 py-3 text-primary-foreground">
            <Bot className="h-5 w-5" />
            <div>
              <p className="font-display text-sm font-semibold">Nyumba AI</p>
              <p className="text-[10px] opacity-80">Recommend · compare · trust tips</p>
            </div>
          </header>

          <div className="flex flex-wrap gap-1.5 border-b p-2">
            {QUICK.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => send(q.message)}
                className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold"
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {turns.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">
                Ask about listings, neighborhoods, or scam warnings.
              </p>
            )}
            {turns.map((t, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 text-sm ${
                  t.role === "user"
                    ? "ml-6 bg-primary text-primary-foreground"
                    : "mr-6 bg-secondary"
                }`}
              >
                <p className="whitespace-pre-wrap">{t.text}</p>
              </div>
            ))}
            {ask.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <form
            className="flex gap-2 border-t p-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Nyumba AI…"
              className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || ask.isPending}
              className="rounded-xl bg-primary p-2 text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
