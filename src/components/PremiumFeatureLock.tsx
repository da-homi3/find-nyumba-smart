import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { getPlusPricing } from "@/lib/revenue/plus-plan";
import { TENANT_PLUS_CONFIG } from "@/lib/revenue/tenant-plus-config";

type Props = {
  title: string;
  body: string;
  compact?: boolean;
};

export function PremiumFeatureLock({ title, body, compact = false }: Readonly<Props>) {
  const pricing = getPlusPricing();
  return (
    <div
      className={`rounded-2xl border border-primary/25 bg-linear-to-br from-primary/10 to-card ${compact ? "p-4" : "p-6"}`}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Tenant Plus</p>
          <h2 className="mt-1 font-display text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            <li>✓ {TENANT_PLUS_CONFIG.contactCreditsPerMonth} contact credits / month</li>
            <li>✓ Personalized & AI-powered matching</li>
            <li>✓ New listing and price-drop alerts</li>
            <li>✓ Provider discovery</li>
            <li>✓ NyumbaSearch AI</li>
            <li>✓ Tenant Profile Card & financial tools</li>
          </ul>
          <p className="mt-3 text-sm font-semibold">
            Best value {pricing.quarterlyKes.toLocaleString()} / 3 months
            <span className="ml-2 font-normal text-muted-foreground line-through">
              {pricing.quarterlyRegularKes.toLocaleString()}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Save {pricing.savingsKes.toLocaleString()} · {pricing.effectiveMonthlyKes.toLocaleString()}
            /month equivalent, or {pricing.monthlyKes.toLocaleString()}/month
          </p>
          <Link
            to="/tenant/checkout"
            search={{ plan: "plus" }}
            className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Upgrade to Plus
          </Link>
        </div>
      </div>
    </div>
  );
}
