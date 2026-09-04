import { Calendar, FileText, MessageCircle, Phone } from "lucide-react";

type PropertyDetailActionBarProps = Readonly<{
  onCall: () => void;
  onMessage: () => void;
  messagePending: boolean;
  messageLabel?: string;
  onApply: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
  onBook: () => void;
}>;

export function PropertyDetailActionBar({
  onCall,
  onMessage,
  messagePending,
  messageLabel = "Message",
  onApply,
  applyLabel = "Apply",
  applyDisabled = false,
  onBook,
}: PropertyDetailActionBarProps) {
  return (
    <div className="fixed bottom-16 inset-x-0 z-20 border-t bg-background/95 px-2 py-2 backdrop-blur sm:px-5 sm:py-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto grid max-w-2xl grid-cols-4 items-stretch gap-1 sm:gap-2">
        <button
          type="button"
          onClick={onCall}
          className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 text-[10px] font-semibold sm:flex-row sm:gap-2 sm:px-3 sm:py-3 sm:text-sm"
        >
          <Phone className="h-4 w-4 shrink-0" />
          <span>Call</span>
        </button>
        <button
          type="button"
          onClick={onMessage}
          disabled={messagePending}
          className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 text-[10px] font-semibold sm:flex-row sm:gap-2 sm:px-3 sm:py-3 sm:text-sm"
        >
          <MessageCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">{messageLabel}</span>
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={applyDisabled}
          className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 text-[10px] font-semibold disabled:opacity-50 sm:flex-row sm:gap-2 sm:px-3 sm:py-3 sm:text-sm"
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate">{applyLabel}</span>
        </button>
        <button
          type="button"
          onClick={onBook}
          className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-gradient-emerald px-1 py-2 text-[10px] font-semibold text-primary-foreground shadow-elegant hover:opacity-95 sm:flex-row sm:gap-2 sm:px-3 sm:py-3 sm:text-sm"
        >
          <Calendar className="h-4 w-4 shrink-0" />
          <span className="sm:hidden">Book</span>
          <span className="hidden sm:inline">Book viewing</span>
        </button>
      </div>
    </div>
  );
}
