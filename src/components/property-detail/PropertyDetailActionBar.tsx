import { Calendar, MessageCircle, Phone } from "lucide-react";

type PropertyDetailActionBarProps = Readonly<{
  onCall: () => void;
  onMessage: () => void;
  messagePending: boolean;
  onBook: () => void;
}>;

export function PropertyDetailActionBar({
  onCall,
  onMessage,
  messagePending,
  onBook,
}: PropertyDetailActionBarProps) {
  return (
    <div className="fixed bottom-16 inset-x-0 z-20 border-t bg-background/95 px-5 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-2">
        <button
          type="button"
          onClick={onCall}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
        >
          <Phone className="h-4 w-4" /> Call
        </button>
        <button
          type="button"
          onClick={onMessage}
          disabled={messagePending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
        >
          <MessageCircle className="h-4 w-4" /> Message
        </button>
        <button
          type="button"
          onClick={onBook}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-emerald px-4 py-3 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95"
        >
          <Calendar className="h-4 w-4" /> Book viewing
        </button>
      </div>
    </div>
  );
}
