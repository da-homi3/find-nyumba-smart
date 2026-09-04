import type { ScoreBreakdown } from "./types";

/** Max points per the creative scoring spec. */
export const SCORE_WEIGHTS = {
  attention: 20,
  relevance: 15,
  brandFit: 10,
  leadPotential: 20,
  shareability: 10,
  savePotential: 10,
  searchability: 5,
  culturalRelevance: 5,
  novelty: 5,
} as const;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function totalScore(
  parts: Omit<ScoreBreakdown, "total" | "viralScore" | "businessScore">,
): number {
  return (
    parts.attention +
    parts.relevance +
    parts.brandFit +
    parts.leadPotential +
    parts.shareability +
    parts.savePotential +
    parts.searchability +
    parts.culturalRelevance +
    parts.novelty
  );
}

export function viralScore(parts: {
  attention: number;
  shareability: number;
  novelty: number;
}): number {
  return Math.round(
    ((parts.attention / 20 + parts.shareability / 10 + parts.novelty / 5) / 3) * 100,
  );
}

export function businessScore(parts: {
  leadPotential: number;
  relevance: number;
  searchability: number;
}): number {
  return Math.round(
    ((parts.leadPotential / 20 + parts.relevance / 15 + parts.searchability / 5) / 3) * 100,
  );
}

export function finalizeScores(
  parts: Omit<ScoreBreakdown, "total" | "viralScore" | "businessScore">,
): ScoreBreakdown {
  return {
    ...parts,
    total: totalScore(parts),
    viralScore: viralScore(parts),
    businessScore: businessScore(parts),
  };
}
