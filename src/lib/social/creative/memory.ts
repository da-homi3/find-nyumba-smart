import { CONCEPT_BANK } from "./concepts";
import { conceptRecentlyUsed, detectFatigue } from "./fatigue";
import { finalizeScores, clamp } from "./scoring";
import type {
  Audience,
  BusinessObjective,
  ContentPostRecord,
  CreativeConcept,
  CreativeMemory,
  ScoreBreakdown,
} from "./types";

export function emptyMemory(): CreativeMemory {
  return { updated_at: new Date().toISOString().slice(0, 10), posts: [], learnings: [] };
}

type ScoreCtx = {
  fatigue: string[];
  priorityAudience?: Audience;
  priorityObjective?: BusinessObjective;
  posts: ContentPostRecord[];
};

function baseScoreParts(concept: CreativeConcept) {
  let attention = 14;
  let leadPotential = 12;
  let shareability = 6;
  let savePotential = 6;
  let searchability = 3;
  let culturalRelevance = 3;

  if (/pov|when |would you|wait until|stop /i.test(concept.hook)) attention += 4;
  if (concept.format === "carousel" || concept.format === "checklist") savePotential += 3;
  if (concept.funnel === "HIGH_INTENT" || concept.funnel === "CONVERSION") leadPotential += 5;
  if (concept.funnel === "AWARENESS") {
    shareability += 3;
    leadPotential -= 2;
  }
  if (concept.searchIntent.length > 20) searchability += 2;
  if (/nairobi|whatsapp|deposit|matatu|sheng|landlord/i.test(concept.kenyanContext)) {
    culturalRelevance += 2;
  }
  if (concept.letter === "C" || concept.format === "cinematic") attention += 2;

  return {
    attention,
    leadPotential,
    shareability,
    savePotential,
    searchability,
    culturalRelevance,
  };
}

function applyFatiguePenalties(
  concept: CreativeConcept,
  ctx: ScoreCtx,
  parts: { attention: number; leadPotential: number; novelty: number },
) {
  let { attention, leadPotential, novelty } = parts;
  for (const tag of concept.fatigueTags) {
    const hit = ctx.fatigue.some(
      (f) => f.toLowerCase().includes(tag) || /catalogue|format|hook|area-guide/i.test(f),
    );
    if (hit) {
      novelty -= 2;
      attention -= 1;
    }
  }
  if (conceptRecentlyUsed(ctx.posts, concept.id, 10)) {
    novelty -= 3;
    attention -= 2;
  }
  if (
    ctx.fatigue.some((f) => /catalogue/i.test(f)) &&
    concept.fatigueTags.includes("listing_tour")
  ) {
    leadPotential -= 4;
    novelty -= 3;
  }
  return { attention, leadPotential, novelty };
}

export function scoreConcept(concept: CreativeConcept, ctx: ScoreCtx): ScoreBreakdown {
  const base = baseScoreParts(concept);
  let relevance = 11;
  const novelty = 3;

  if (ctx.priorityAudience && concept.audience === ctx.priorityAudience) relevance += 3;
  if (ctx.priorityObjective && concept.objective === ctx.priorityObjective) {
    base.leadPotential += 3;
  }

  const adjusted = applyFatiguePenalties(concept, ctx, {
    attention: base.attention,
    leadPotential: base.leadPotential,
    novelty,
  });

  return finalizeScores({
    attention: clamp(adjusted.attention, 0, 20),
    relevance: clamp(relevance, 0, 15),
    brandFit: clamp(8, 0, 10),
    leadPotential: clamp(adjusted.leadPotential, 0, 20),
    shareability: clamp(base.shareability, 0, 10),
    savePotential: clamp(base.savePotential, 0, 10),
    searchability: clamp(base.searchability, 0, 5),
    culturalRelevance: clamp(base.culturalRelevance, 0, 5),
    novelty: clamp(adjusted.novelty, 0, 5),
  });
}

export function rankConcepts(
  memory: CreativeMemory,
  opts?: { priorityAudience?: Audience; priorityObjective?: BusinessObjective },
): Array<{ concept: CreativeConcept; scores: ScoreBreakdown }> {
  const fatigue = detectFatigue(memory.posts);
  return CONCEPT_BANK.map((concept) => ({
    concept,
    scores: scoreConcept(concept, {
      fatigue,
      priorityAudience: opts?.priorityAudience,
      priorityObjective: opts?.priorityObjective,
      posts: memory.posts,
    }),
  })).sort((a, b) => {
    // Prefer business+total blend
    const aBlend =
      a.scores.total * 0.55 + a.scores.businessScore * 0.35 + a.scores.viralScore * 0.1;
    const bBlend =
      b.scores.total * 0.55 + b.scores.businessScore * 0.35 + b.scores.viralScore * 0.1;
    return bBlend - aBlend;
  });
}

export function recordLearning(memory: CreativeMemory, learning: string): CreativeMemory {
  return {
    ...memory,
    updated_at: new Date().toISOString().slice(0, 10),
    learnings: [learning, ...memory.learnings].slice(0, 100),
  };
}

export function upsertPost(memory: CreativeMemory, post: ContentPostRecord): CreativeMemory {
  const others = memory.posts.filter((p) => p.post_id !== post.post_id);
  return {
    updated_at: new Date().toISOString().slice(0, 10),
    posts: [post, ...others].sort((a, b) => b.date.localeCompare(a.date)),
    learnings: memory.learnings,
  };
}
