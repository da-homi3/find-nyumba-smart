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
    <div className="fixed bottom-16 inset-x-0 z-20 border-t bg-background/95 px-3 py-2 backdrop-blur sm:px-5 sm:py-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-2xl items-stretch gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onCall}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2.5 text-xs font-semibold sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
        >
          <Phone className="h-4 w-4 shrink-0" />
          <span>Call</span>
        </button>
        <button
          type="button"
          onClick={onMessage}
          disabled={messagePending}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2.5 text-xs font-semibold sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
        >
          <MessageCircle className="h-4 w-4 shrink-0" />
          <span>Message</span>
        </button>
        <button
          type="button"
          onClick={onBook}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-gradient-emerald px-2 py-2.5 text-xs font-semibold text-primary-foreground shadow-elegant hover:opacity-95 sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
        >
          <Calendar className="h-4 w-4 shrink-0" />
          <span className="sm:hidden">Book</span>
          <span className="hidden sm:inline">Book viewing</span>
        </button>
      </div>
    </div>
  );
}
