import { reputationBadgeFromScore } from "@/lib/reputation/badge";

type ReputationBadgeProps = Readonly<{
  /** Prefer passing a public tier label from getPublicReputationTiers. */
  tierLabel?: string | null;
  /** Only for the signed-in user's own score (settings). */
  score?: number;
  className?: string;
}>;

const TONE_CLASS: Record<"emerald" | "sky" | "slate", string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  sky: "text-sky-600 dark:text-sky-400",
  slate: "text-muted-foreground",
};

export function ReputationBadge(props: ReputationBadgeProps) {
  const { tierLabel, score, className = "" } = props;
  const fromScore = score == null ? null : reputationBadgeFromScore(score);
  const label = tierLabel ?? fromScore?.label ?? null;
  if (!label) return null;

  const tone = fromScore?.tone ?? "slate";
  return <span className={`text-xs font-semibold ${TONE_CLASS[tone]} ${className}`}>{label}</span>;
}
