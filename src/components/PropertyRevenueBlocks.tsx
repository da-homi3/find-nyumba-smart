import { Link } from "@tanstack/react-router";
import { ShieldCheck, Truck, Landmark, Shield, Sparkles } from "lucide-react";
import { AdUnit } from "@/components/AdUnit";
import { PlusUpsellBanner } from "@/components/PlusUpsellBanner";
import { formatKes, type Property } from "@/lib/properties";

type Props = {
  property: Property;
  isPlus: boolean;
};

export function PropertyVerifyCard({ property }: Readonly<{ property: Property }>) {
  if (property.nyumba_verified_at) return null;
  return (
    <section className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        <div>
          <h3 className="font-display text-sm font-semibold">Not sure this home is real?</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            NyumbaSearch can verify vacancy, ownership, and photos on-site.
          </p>
          <Link
            to="/verify/request"
            search={{ propertyId: property.id }}
            className="mt-2 inline-block text-xs font-bold text-primary"
          >
            Request verification →
          </Link>
        </div>
      </div>
    </section>
  );
}

export function PropertyServicesStrip() {
  const links = [
    { to: "/services/movers", icon: Truck, label: "Movers" },
    { to: "/services", icon: Sparkles, label: "Home services" },
    { to: "/finance", icon: Landmark, label: "Mortgages" },
    { to: "/insurance", icon: Shield, label: "Insurance" },
  ];
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-semibold">Setting up your new home?</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        NyumbaSearch earns a referral fee from partners. You pay nothing extra.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center text-xs font-semibold hover:border-primary/30"
          >
            <l.icon className="h-5 w-5 text-primary" />
            {l.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PropertyMortgageBanner({ property }: Readonly<{ property: Property }>) {
  if (property.rent_kes < 200_000) return null;
  return (
    <Link
      to="/finance"
      className="mt-6 block rounded-2xl border bg-gradient-to-r from-primary/10 to-gold/10 p-4"
    >
      <p className="text-sm font-semibold">Ready to own instead of rent?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Check mortgage eligibility for homes around {formatKes(property.rent_kes * 12 * 10)}.
      </p>
    </Link>
  );
}

export function PropertyPlusUpsell({ isPlus }: Readonly<{ isPlus: boolean }>) {
  if (isPlus) return null;
  return (
    <div className="mt-6">
      <PlusUpsellBanner
        compact
        title="See scam risk scores with Plus"
        dismissKey="property-intel"
      />
    </div>
  );
}

export function PropertySponsoredAd() {
  return (
    <div className="mt-6">
      <AdUnit
        label="Partner"
        title="Advertise on NyumbaSearch"
        body="Reach verified tenants searching for homes in Nairobi."
        href="/advertise"
        variant="card"
      />
    </div>
  );
}

export function PropertyRevenueBlocks({ property, isPlus }: Readonly<Props>) {
  return (
    <>
      <PropertyVerifyCard property={property} />
      <PropertyMortgageBanner property={property} />
      <PropertyPlusUpsell isPlus={isPlus} />
      <PropertySponsoredAd />
      <PropertyServicesStrip />
    </>
  );
}
