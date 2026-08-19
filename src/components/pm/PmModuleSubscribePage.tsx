import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { useAuth } from "@/hooks/use-auth";
import { useProfilePhone } from "@/hooks/use-profile-phone";
import { type PmPortal } from "@/components/pm/pm-nav";
import { getPmModuleStatus, subscribePropertyManagement } from "@/lib/api/pm-module.functions";
import { formatKes } from "@/lib/properties";

const MANAGE_PATH = {
  landlord: "/landlord/manage",
  agency: "/agency/manage",
  manager: "/manager/manage",
} as const;

export function PmModuleSubscribePage({ portal }: Readonly<{ portal: PmPortal }>) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { phone: profilePhone } = useProfilePhone();
  const [checkout, setCheckout] = useState<{
    tier: string;
    priceKes: number;
  } | null>(null);

  const subscribePath = `${MANAGE_PATH[portal]}/subscribe`;

  const statusQ = useQuery({
    queryKey: ["pm-module-status"],
    queryFn: () => getPmModuleStatus(),
  });

  const subscribe = useMutation({
    mutationFn: () => subscribePropertyManagement(),
    onSuccess: (res) => {
      if (res.status === "already_active" || res.status === "included_with_plan") {
        toast.success(
          res.status === "included_with_plan"
            ? "Property Management is included with your paid plan"
            : "Property Management is already active",
        );
        qc.invalidateQueries({ queryKey: ["pm-module-status"] });
        qc.invalidateQueries({ queryKey: ["pm-properties"] });
        navigate({ to: MANAGE_PATH[portal] });
        return;
      }
      setCheckout({ tier: res.tier, priceKes: res.priceKes });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (statusQ.isLoading || !user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (statusQ.data?.active) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="font-display text-2xl font-semibold">Property Management is active</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your module is unlocked. Manage units, tenants, and rent from your portfolio.
        </p>
        <Link
          to={MANAGE_PATH[portal]}
          className="mt-6 inline-flex rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
        >
          Open portfolio
        </Link>
      </div>
    );
  }

  if (checkout) {
    const tierLabel = checkout.tier.replace("pm-", "").replace(/^\w/, (c) => c.toUpperCase());
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="font-display text-2xl font-semibold">Property Management</h1>
        <div className="mt-8">
          <CheckoutFlow
            checkoutPath={subscribePath}
            lineItem={{
              title: `PM ${tierLabel}`,
              subtitle: "Monthly module — independent of marketplace plans",
              amountKes: checkout.priceKes,
              features: ["Rent tracking & collection", "Tenants & leases", "Maintenance routing"],
            }}
            metadata={{
              paymentType: "pm_module",
              plan: checkout.tier,
              billingCycle: "monthly",
            }}
            defaultPhone={profilePhone ?? ""}
            allowQuarterly={false}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["pm-module-status"] });
              navigate({ to: MANAGE_PATH[portal] });
            }}
          />
        </div>
      </div>
    );
  }

  const price = statusQ.data?.recommendedPriceKes ?? 1500;
  const tierName = statusQ.data?.recommendedTierName ?? "PM Starter";

  return (
    <div className="mx-auto max-w-lg px-4 py-10 text-center">
      <h1 className="font-display text-2xl font-semibold">Add Property Management</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Recommended for your portfolio: <strong>{tierName}</strong> ({statusQ.data?.unitCount ?? 0}{" "}
        units) at {formatKes(price)}/mo. Paid marketplace subscribers get PM free — a 1% fee still
        applies on rent collected. Otherwise pay your first month and get the next month free.
      </p>
      <button
        type="button"
        disabled={subscribe.isPending}
        onClick={() => subscribe.mutate()}
        className="mt-8 inline-flex rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
      >
        {subscribe.isPending ? "Checking…" : "Continue"}
      </button>
      <div className="mt-4">
        <Link to={MANAGE_PATH[portal]} className="text-sm text-muted-foreground underline">
          Back
        </Link>
      </div>
    </div>
  );
}
