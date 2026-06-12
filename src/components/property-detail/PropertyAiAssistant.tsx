import { Bot, Send } from "lucide-react";
import type { FormEvent } from "react";

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

type PropertyAiAssistantProps = Readonly<{
  messages: ChatMessage[];
  chatInput: string;
  chatLoading: boolean;
  onChatInputChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}>;

export function PropertyAiAssistant({
  messages,
  chatInput,
  chatLoading,
  onChatInputChange,
  onSubmit,
}: PropertyAiAssistantProps) {
  return (
    <section className="mt-6 rounded-2xl border bg-card p-4 shadow-soft">
      <h3 className="font-display text-sm font-semibold flex items-center gap-1.5">
        <Bot className="h-4.5 w-4.5 text-primary" />
        Ask the AI Assistant
      </h3>
      <div className="mt-3 max-h-48 overflow-y-auto space-y-2 border-b pb-3 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {chatLoading && <div className="text-muted-foreground italic">AI is typing...</div>}
      </div>
      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          placeholder="Ask about water supply, safety, noise..."
          aria-label="Message to AI assistant"
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          className="flex-1 rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          aria-label="Send message"
          className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground hover:opacity-95"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </section>
  );
}
