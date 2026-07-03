import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { LandlordShell } from "@/components/LandlordShell";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { useAuth } from "@/hooks/use-auth";
import { listLandlordProperties } from "@/lib/api/nyumba.functions";
import { BOOST_PACKAGES, boostPrice } from "@/lib/revenue/plans";
import type { BoostPackage } from "@/lib/revenue/types";
import { useEffect, useState } from "react";
import { formatKes } from "@/lib/properties";

const searchSchema = z.object({
  package: z.enum(["spotlight", "homepage", "campaign"]).optional(),
  propertyId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/landlord/boost")({
  validateSearch: (search) => searchSchema.parse(search),
  component: () => (
    <LandlordShell>
      <BoostPage />
    </LandlordShell>
  ),
});

function BoostPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { package: pkgParam, propertyId: initialProperty } = Route.useSearch();
  const [step, setStep] = useState(initialProperty ? 2 : 1);
  const [packageId, setPackageId] = useState<BoostPackage>(pkgParam ?? "spotlight");
  const [propertyId, setPropertyId] = useState(initialProperty ?? "");
  const [campaignAmount, setCampaignAmount] = useState(20_000);

  useEffect(() => {
    if (pkgParam) setPackageId(pkgParam);
  }, [pkgParam]);

  useEffect(() => {
    if (initialProperty) setPropertyId(initialProperty);
  }, [initialProperty]);

  useEffect(() => {
    if (pkgParam && initialProperty) setStep(3);
  }, [pkgParam, initialProperty]);

  const { data: properties = [] } = useQuery({
    queryKey: ["my-properties-list", user?.id],
    enabled: !!user,
    queryFn: () => listLandlordProperties(),
  });

  const active = properties.filter((p) => p.is_active);
  const pkg = BOOST_PACKAGES.find((p) => p.id === packageId)!;
  const boostAmount =
    packageId === "campaign" ? boostPrice("campaign", campaignAmount) : boostPrice(packageId);

  if (step === 3) {
    return (
      <div className="mx-auto max-w-lg px-6 py-10">
        <CheckoutFlow
          checkoutPath={`/landlord/boost?package=${packageId}&propertyId=${propertyId}`}
          lineItem={{
            title: `${pkg.name} boost`,
            subtitle: pkg.placement,
            amountKes: boostAmount,
          }}
          metadata={{
            paymentType: "property_boost",
            propertyId,
            boostPackage: packageId,
          }}
          defaultPhone={(user?.user_metadata?.phone as string | undefined) ?? user?.phone ?? ""}
          allowQuarterly={false}
          onSuccess={() => navigate({ to: "/landlord/dashboard" })}
        />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your listing will appear in boosted positions within 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold">Boost a listing</h1>
      {step === 1 && (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Choose a visibility package.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {BOOST_PACKAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPackageId(p.id)}
                className={`rounded-2xl border p-4 text-left ${packageId === p.id ? "border-primary ring-2 ring-primary/20" : ""}`}
              >
                <div className="font-semibold">{p.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{p.placement}</div>
                <div className="mt-2 font-display text-lg text-primary">
                  {p.priceRange ?? formatKes(p.priceKes)}
                </div>
                <div className="text-[10px] text-muted-foreground">{p.durationDays} days</div>
              </button>
            ))}
          </div>
          {packageId === "campaign" && (
            <label className="mt-4 block text-sm">
              <span className="font-medium">Campaign budget (KES 20,000 – 100,000)</span>
              <input
                type="range"
                min={20000}
                max={100000}
                step={5000}
                value={campaignAmount}
                onChange={(e) => setCampaignAmount(Number(e.target.value))}
                className="mt-2 w-full"
              />
              <span className="mt-1 block font-semibold text-primary">
                {formatKes(campaignAmount)}
              </span>
            </label>
          )}
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            Next: select listing
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <label className="mt-6 block text-sm font-semibold">
            <span className="mb-2 block">Select listing</span>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm"
            >
              <option value="">Choose…</option>
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} — {p.neighborhood}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl border py-3 text-sm font-semibold"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!propertyId}
              onClick={() => setStep(3)}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Continue to payment
            </button>
          </div>
        </>
      )}
      <Link to="/landlord/dashboard" className="mt-6 block text-center text-sm text-primary">
        ← Dashboard
      </Link>
    </div>
  );
}
