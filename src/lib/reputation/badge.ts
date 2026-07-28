export type ReputationTier = "highly_trusted" | "trusted" | "building" | null;

export type ReputationBadgeInfo = {
  tier: ReputationTier;
  label: string | null;
  /** Tailwind-friendly token — never used to imply a negative public label. */
  tone: "emerald" | "sky" | "slate" | null;
};

/** Public signal only — never expose factors or punitive labels. */
export function reputationBadgeFromScore(score: number): ReputationBadgeInfo {
  if (score >= 85) {
    return { tier: "highly_trusted", label: "Highly trusted", tone: "emerald" };
  }
  if (score >= 65) {
    return { tier: "trusted", label: "Trusted", tone: "sky" };
  }
  if (score >= 40) {
    return { tier: "building", label: "New / building trust", tone: "slate" };
  }
  return { tier: null, label: null, tone: null };
}

export function publicTierLabelFromScore(score: number): string | null {
  return reputationBadgeFromScore(score).label;
}
