import { Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPromoStatus } from "@/lib/api/promo.functions";
import type { AccountRole } from "@/lib/account-roles";
import { PROMO_LABELS } from "@/lib/promo/constants";

const PROMO_ROLES = new Set<AccountRole>(["agency", "manager", "landlord"]);

export function PromoBadge({ role }: Readonly<{ role: AccountRole }>) {
  const { data } = useQuery({
    queryKey: ["promo-status"],
    queryFn: () => getPromoStatus(),
    staleTime: 90_000,
    refetchInterval: 120_000,
  });

  if (!PROMO_ROLES.has(role)) return null;

  const promoRole = role as keyof typeof PROMO_LABELS;
  const status = data?.[promoRole];
  if (!status || status.remaining <= 0) return null;

  const bonus = PROMO_LABELS[promoRole].bonusListings;

  return (
    <div className="mt-2 rounded-xl border border-[#F6AD5544] bg-linear-to-br from-[#F6AD5522] to-[#F6AD5511] px-3 py-2">
      <p className="flex items-center gap-2 text-[13px] font-bold text-[#F6AD55]">
        <Trophy className="h-4 w-4 shrink-0" aria-hidden />
        Founding Member offer — {status.remaining} of {status.total} spots left
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Get {bonus} bonus free listings after your first paid month
      </p>
    </div>
  );
}
