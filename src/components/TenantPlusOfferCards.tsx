import { useQuery } from "@tanstack/react-query";
import { getPlusPricingPublic } from "@/lib/api/revenue.functions";
import { getPlusPricing } from "@/lib/revenue/plus-plan";
import { formatKes } from "@/lib/properties";

type Props = {
  selected: "monthly" | "quarterly";
  onSelect: (cycle: "monthly" | "quarterly") => void;
};

export function TenantPlusOfferCards({ selected, onSelect }: Readonly<Props>) {
  const { data } = useQuery({
    queryKey: ["plus-pricing"],
    queryFn: () => getPlusPricingPublic(),
    staleTime: 60_000,
  });
  const pricing = data ?? getPlusPricing();
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Find your home faster, smarter, and with more confidence.
      </p>
      <button
        type="button"
        onClick={() => onSelect("quarterly")}
        className={`rounded-2xl border p-4 text-left ${
          selected === "quarterly" ? "border-primary bg-primary/10" : "border-border"
        }`}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
          Best value · 3-month offer
        </p>
        <p className="mt-1 font-display text-2xl font-semibold">{formatKes(pricing.quarterlyKes)}</p>
        <p className="text-sm text-muted-foreground">
          <span className="line-through">{formatKes(pricing.quarterlyRegularKes)}</span>
          {" · "}
          Save {formatKes(pricing.savingsKes)}
        </p>
        <p className="mt-1 text-xs font-semibold text-primary">
          That&apos;s {formatKes(pricing.effectiveMonthlyKes)}/month
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {formatKes(pricing.monthlyKes)} × 3 = {formatKes(pricing.quarterlyRegularKes)} regular.
          Offer {formatKes(pricing.quarterlyKes)}.
        </p>
      </button>
      <button
        type="button"
        onClick={() => onSelect("monthly")}
        className={`rounded-2xl border p-4 text-left ${
          selected === "monthly" ? "border-primary bg-primary/10" : "border-border"
        }`}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monthly</p>
        <p className="mt-1 font-display text-xl font-semibold">
          {formatKes(pricing.monthlyKes)}
          <span className="text-sm font-normal text-muted-foreground"> / month</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Flexible monthly access</p>
      </button>
    </div>
  );
}
