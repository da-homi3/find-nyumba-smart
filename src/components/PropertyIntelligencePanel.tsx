import { motion } from "framer-motion";
import { Bus, Droplets, Shield, Volume2, Wifi, type LucideIcon } from "lucide-react";
import type { ListingIntel, ReliabilityLabel } from "@/lib/listing-intel";

type IntelItem = {
  icon: LucideIcon;
  title: string;
  value: string;
  color: string;
  note: string;
  metric: number;
  wide?: boolean;
};

function reliabilityPct(label: ReliabilityLabel | ListingIntel["noise"]): number {
  const map: Record<string, number> = {
    Poor: 25,
    Moderate: 55,
    Good: 80,
    Excellent: 95,
    Low: 85,
    High: 30,
  };
  return map[label] ?? 60;
}

function waterNote(intel: ListingIntel): string {
  if (intel.borehole) {
    return "Borehole on site · reliable supply in this building";
  }
  return "Mains supply · check peak-hour pressure with caretaker";
}

function securityNote(intel: ListingIntel): string {
  if (intel.gated && intel.guard) return "Gated compound with on-site guard";
  if (intel.gated) return "Gated compound";
  return "Street-level access — visit before dark";
}

function noiseNote(noise: ListingIntel["noise"]): string {
  if (noise === "Low") return "Quiet residential pocket";
  if (noise === "High") return "Near main road — expect traffic noise";
  return "Moderate daytime activity";
}

function internetNote(intel: ListingIntel): string {
  if (intel.internetProviders.length > 0) {
    return intel.internetProviders.join(" · ");
  }
  return "Confirm with landlord before signing";
}

function buildIntelItems(intel: ListingIntel): IntelItem[] {
  return [
    {
      icon: Droplets,
      title: "Water",
      value: intel.water,
      color: "#48bb78",
      note: waterNote(intel),
      metric: reliabilityPct(intel.water),
    },
    {
      icon: Shield,
      title: "Security",
      value: intel.security,
      color: "#4299e1",
      note: securityNote(intel),
      metric: reliabilityPct(intel.security),
    },
    {
      icon: Wifi,
      title: "Internet",
      value: intel.internet ? "Available" : "Limited",
      color: "#4299e1",
      note: internetNote(intel),
      metric: intel.internet ? 90 : 20,
    },
    {
      icon: Volume2,
      title: "Noise",
      value: intel.noise,
      color: "#f6ad55",
      note: noiseNote(intel.noise),
      metric: reliabilityPct(intel.noise),
    },
    {
      icon: Bus,
      title: "Commute",
      value: `~${intel.commuteCbdMins} min`,
      color: "#f6ad55",
      note: `${intel.matatuRoute} to CBD`,
      metric: Math.max(0, 100 - intel.commuteCbdMins),
      wide: true,
    },
  ];
}

function IntelCard({ item, index }: Readonly<{ item: IntelItem; index: number }>) {
  const Icon = item.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      whileHover={{ scale: 1.02, boxShadow: `0 8px 32px ${item.color}33` }}
      className={`rounded-2xl border bg-muted/40 p-4 ${item.wide ? "sm:col-span-2" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Icon className="h-5 w-5 shrink-0" style={{ color: item.color }} aria-hidden />
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ color: item.color, background: `${item.color}20` }}
        >
          {item.value}
        </span>
      </div>
      <p className="mt-2 font-semibold">{item.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${item.metric}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1], delay: index * 0.1 }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(to right, ${item.color}80, ${item.color})` }}
        />
      </div>
    </motion.div>
  );
}

export function PropertyIntelligencePanel({ intel }: Readonly<{ intel: ListingIntel }>) {
  const items = buildIntelItems(intel);

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
      viewport={{ once: true }}
      className="mt-6 rounded-2xl border bg-card p-4"
    >
      <h2 className="font-display text-lg font-semibold">Property intelligence</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Community-reported signals from verified property owners.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item, index) => (
          <IntelCard key={item.title} item={item} index={index} />
        ))}
      </div>
    </motion.section>
  );
}
