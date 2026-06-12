import { Link } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";

type Props = {
  title?: string;
  body?: string;
  dismissKey?: string;
  compact?: boolean;
};

export function PlusUpsellBanner({
  title = "Unlock NyumbaSearch Plus",
  body = "Early access to new listings, unlimited search alerts, and scam risk scores on every home.",
  dismissKey,
  compact = false,
}: Readonly<Props>) {
  const storageKey = dismissKey ? `plus-banner-dismiss:${dismissKey}` : null;
  const [dismissed, setDismissed] = useState(() => {
    if (!storageKey || globalThis.localStorage === undefined) return false;
    return globalThis.localStorage.getItem(storageKey) === "1";
  });

  if (dismissed) return null;

  return (
    <div
      className={`relative rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/15 to-primary/10 ${compact ? "p-3" : "p-4"}`}
    >
      {storageKey && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            globalThis.localStorage?.setItem(storageKey, "1");
            setDismissed(true);
          }}
          className="absolute right-2 top-2 rounded-lg p-1 text-muted-foreground hover:bg-background/50"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-start gap-3 pr-6">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-gold text-gold-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {!compact && <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>}
          <Link
            to="/tenant/checkout"
            search={{ plan: "plus" }}
            className="mt-2 inline-block text-xs font-bold text-primary hover:underline"
          >
            Go Plus — KES 500/mo →
          </Link>
        </div>
      </div>
    </div>
  );
}
