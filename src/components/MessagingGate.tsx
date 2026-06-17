import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PLUS_PLAN } from "@/lib/revenue/plans";

type Props = Readonly<{
  children: ReactNode;
}>;

export function MessagingGate({ children }: Props) {
  const { isPlus, loading } = useEntitlements();

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Checking subscription…
      </div>
    );
  }

  if (isPlus) return <>{children}</>;

  return (
    <div className="rounded-2xl border bg-card p-8 text-center">
      <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
      <h3 className="mt-4 font-display text-lg font-semibold">Messaging is a Plus feature</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Unlock unlimited contact reveals, scam-risk scores, and in-app messaging with every landlord
        — KES {PLUS_PLAN.monthlyKes}/mo.
      </p>
      <ul className="mx-auto mt-4 max-w-sm space-y-1 text-left text-xs text-muted-foreground">
        {PLUS_PLAN.features.slice(0, 4).map((f) => (
          <li key={f}>• {f}</li>
        ))}
      </ul>
      <Link
        to="/tenant/checkout"
        search={{ plan: "plus" }}
        className="mt-6 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
      >
        Upgrade to Plus
      </Link>
    </div>
  );
}
