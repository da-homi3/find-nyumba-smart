import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LazyRadar } from "@/components/LazyRadar";
import { getListingRiskScore } from "@/lib/api/listing.functions";
import type { RiskLevel } from "@/lib/listings/risk-score";

const SCAN_MIN_MS = 2200;

type Props = {
  listingId: string;
  isPlus: boolean;
};

const RISK_STYLES: Record<
  RiskLevel,
  { color: string; label: string; bg: string }
> = {
  low: {
    color: "#48bb78",
    label: "Low risk",
    bg: "rgba(72,187,120,0.1)",
  },
  medium: {
    color: "#f6ad55",
    label: "Medium risk — review carefully",
    bg: "rgba(246,173,85,0.1)",
  },
  high: {
    color: "#fc4a4a",
    label: "High risk — proceed with caution",
    bg: "rgba(252,74,74,0.1)",
  },
};

function RiskResultCard({ risk }: Readonly<{ risk: { level: RiskLevel; reasons: string[] } }>) {
  const styles = RISK_STYLES[risk.level];
  return (
    <div
      className="flex h-full flex-col justify-center p-4"
      style={{ background: styles.bg }}
    >
      <span className="text-base font-bold" style={{ color: styles.color }}>
        {styles.label}
      </span>
      <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-white/70">
        {risk.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}

export function ScamRiskScanner({ listingId, isPlus }: Readonly<Props>) {
  const [phase, setPhase] = useState<"scanning" | "done">("scanning");
  const [risk, setRisk] = useState<{ level: RiskLevel; reasons: string[] } | null>(null);

  useEffect(() => {
    if (!isPlus) return;

    let mounted = true;
    const started = Date.now();

    getListingRiskScore({ data: { listingId } })
      .then((data) => {
        const elapsed = Date.now() - started;
        const wait = Math.max(0, SCAN_MIN_MS - elapsed);
        globalThis.setTimeout(() => {
          if (!mounted) return;
          setRisk(data);
          setPhase("done");
        }, wait);
      })
      .catch(() => {
        if (!mounted) return;
        setRisk({
          level: "medium",
          reasons: ["Could not complete risk scan — review listing details manually"],
        });
        setPhase("done");
      });

    return () => {
      mounted = false;
    };
  }, [listingId, isPlus]);

  if (!isPlus) {
    return (
      <div className="relative h-[140px] overflow-hidden rounded-2xl bg-[#0d1117]">
        <div className="absolute inset-0 opacity-50 blur-sm">
          <LazyRadar
            speed={0.6}
            scale={0.5}
            ringCount={6}
            spokeCount={8}
            ringThickness={0.05}
            spokeThickness={0.01}
            sweepSpeed={0.8}
            sweepWidth={2}
            sweepLobes={1}
            color="#1eb88a"
            backgroundColor="#0d1117"
            falloff={2}
            brightness={0.8}
            enableMouseInteraction={false}
            mouseInfluence={0}
          />
        </div>
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
          <span className="text-[0.9375rem] font-semibold text-white">
            Scam risk score — Plus only
          </span>
          <Link
            to="/tenant/checkout"
            className="rounded-full bg-[#1eb88a] px-4 py-1.5 text-[0.8125rem] font-semibold text-white no-underline"
          >
            Unlock for KES 500/mo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[140px] overflow-hidden rounded-2xl bg-[#0d1117]">
      {phase === "scanning" ? (
        <>
          <LazyRadar
            speed={1.2}
            scale={0.8}
            ringCount={8}
            spokeCount={12}
            ringThickness={0.05}
            spokeThickness={0.012}
            sweepSpeed={1.6}
            sweepWidth={3}
            sweepLobes={1}
            color="#1eb88a"
            backgroundColor="#0d1117"
            falloff={2}
            brightness={1.1}
            enableMouseInteraction={false}
            mouseInfluence={0}
          />
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="text-sm text-white/70">Scanning listing for red flags…</span>
          </div>
        </>
      ) : null}
      {phase === "done" && risk ? <RiskResultCard risk={risk} /> : null}
    </div>
  );
}
