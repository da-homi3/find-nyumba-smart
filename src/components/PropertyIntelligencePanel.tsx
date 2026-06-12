import { Droplets, Shield, Wifi, Volume2, Bus } from "lucide-react";
import type { ListingIntel } from "@/lib/listing-intel";

export function PropertyIntelligencePanel({ intel }: Readonly<{ intel: ListingIntel }>) {
  return (
    <section className="mt-6 rounded-2xl border bg-card p-4">
      <h2 className="font-display text-lg font-semibold">Property intelligence</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Community-reported signals — no agent spin.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <IntelRow
          icon={Droplets}
          title="Water"
          value={intel.water}
          detail={
            intel.borehole
              ? "Borehole on site · reliable supply in this building"
              : "Mains supply · check peak-hour pressure with caretaker"
          }
        />
        <IntelRow
          icon={Shield}
          title="Security"
          value={intel.security}
          detail={
            intel.gated && intel.guard
              ? "Gated compound with on-site guard"
              : intel.gated
                ? "Gated compound"
                : "Street-level access — visit before dark"
          }
        />
        <IntelRow
          icon={Wifi}
          title="Internet"
          value={intel.internet ? "Available" : "Limited"}
          detail={
            intel.internetProviders.length
              ? intel.internetProviders.join(" · ")
              : "Confirm with landlord before signing"
          }
        />
        <IntelRow
          icon={Volume2}
          title="Noise"
          value={intel.noise}
          detail={
            intel.noise === "Low"
              ? "Quiet residential pocket"
              : intel.noise === "High"
                ? "Near main road — expect traffic noise"
                : "Moderate daytime activity"
          }
        />
        <IntelRow
          icon={Bus}
          title="Commute"
          value={`~${intel.commuteCbdMins} min`}
          detail={`${intel.matatuRoute} to CBD`}
          className="sm:col-span-2"
        />
      </div>
    </section>
  );
}

function IntelRow({
  icon: Icon,
  title,
  value,
  detail,
  className = "",
}: {
  icon: typeof Droplets;
  title: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-secondary/60 p-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>
      <p className="mt-1 font-display text-sm font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
