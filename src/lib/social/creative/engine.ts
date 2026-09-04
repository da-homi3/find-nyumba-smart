import { appendSocialUtm } from "@/lib/social/content-engine";
import { tieredHashtags } from "@/lib/social/keywords";
import { assertBriefSafe, runQualityGate } from "./quality-gate";
import { detectFatigue } from "./fatigue";
import { rankConcepts } from "./memory";
import type {
  Audience,
  BusinessObjective,
  CreativeBrief,
  CreativeConcept,
  CreativeMemory,
  ReelPackage,
} from "./types";

export type PlanOptions = {
  priorityAudience?: Audience;
  priorityObjective?: BusinessObjective;
  /** Live listing deep link — required for concepts with requiresVerifiedFacts */
  listingUrl?: string;
  listingLabel?: string;
  platform?: "instagram" | "tiktok" | "youtube" | "facebook" | "linkedin" | "x";
};

function buildReelPackage(concept: CreativeConcept): ReelPackage {
  return {
    concept: concept.name,
    objective: concept.objective,
    targetAudience: concept.audience,
    hook1to3s: concept.hook,
    script: [
      `HOOK (0–3s): ${concept.hook}`,
      `SETUP (3–8s): ${concept.keyMessage}`,
      `PROOF (8–20s): Show the mechanism — ${concept.mechanism}`,
      `NYUMBA (20–28s): ${concept.nyumbaSpin}`,
      `CTA (28–35s): ${concept.cta}`,
    ],
    shotList: [
      "Cold open: face or hero visual matching the hook",
      "B-roll of Nairobi housing context (streets, gates, interiors — original footage only)",
      "Product or map moment (screen or listing hero) if relevant",
      "End card with CTA + URL on screen",
    ],
    camera: [
      "Handheld UGC for humour/POV; locked-off or gimbal for cinematic reveals",
      "Close-up text overlays; avoid covering faces",
    ],
    onScreenText: [concept.hook.slice(0, 48), "NyumbaSearch", concept.cta.slice(0, 40)],
    voiceover: [concept.hook, concept.keyMessage, concept.cta],
    audioDirection:
      "Trending-but-safe audio OR original VO-forward. No copyrighted tracks without license.",
    transitions:
      "Hard cuts on jokes; dissolve/reveal for cinematic. Keep under 45s unless Shorts long-form.",
    broll: ["Neighbourhood establishing shot", "Phone search UI", "Door/key lifestyle detail"],
    ending: `Logo + ${concept.cta}`,
    cta: concept.cta,
  };
}

function captionFor(concept: CreativeConcept, listingLabel?: string): string {
  const lines = [
    concept.hook,
    "",
    concept.keyMessage,
    listingLabel ? `\nFeatured: ${listingLabel}` : "",
    "",
    concept.cta,
    concept.destination,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Full creative planning cycle (spec §31) without fabricating metrics or inventing inventory.
 */
export function planNextContent(memory: CreativeMemory, opts: PlanOptions = {}): CreativeBrief {
  const fatigue = detectFatigue(memory.posts);
  const ranked = rankConcepts(memory, {
    priorityAudience: opts.priorityAudience,
    priorityObjective: opts.priorityObjective,
  });

  let selected = ranked[0]!;
  // Skip fact-heavy concepts if no listing provided
  if (selected.concept.requiresVerifiedFacts && !opts.listingUrl) {
    const alt = ranked.find((r) => !r.concept.requiresVerifiedFacts);
    if (alt) selected = alt;
  }

  const concept = selected.concept;
  const platform = opts.platform ?? "instagram";
  const destinationUrl = opts.listingUrl
    ? appendSocialUtm(opts.listingUrl, {
        source: platform,
        campaign: concept.id,
        content: concept.letter.toLowerCase(),
      })
    : appendSocialUtm(concept.destination, {
        source: platform,
        campaign: concept.id,
      });

  const tags = tieredHashtags("Nairobi");
  const hashtags = [...tags.brand, ...tags.intent.slice(0, 2), ...tags.category.slice(0, 1)];

  const caption = captionFor(concept, opts.listingLabel);
  const quality = runQualityGate(concept, caption, destinationUrl);
  const brief: CreativeBrief = {
    selected: concept,
    scores: selected.scores,
    alternatives: ranked.slice(1, 5),
    fatigue,
    quality,
    reel:
      concept.format === "reel" ||
      concept.format === "pov" ||
      concept.format === "property_tour" ||
      concept.format === "talking_head" ||
      concept.format === "screen_recording"
        ? buildReelPackage(concept)
        : undefined,
    caption: `${caption}\n\n${hashtags.join(" ")}`,
    hashtags,
    locationTag: "Nairobi, Kenya",
    destinationUrl,
    warnings: [],
  };
  brief.warnings = assertBriefSafe(brief);
  if (!quality.pass) {
    brief.warnings.push("Quality gate weak — revise hook/CTA before publish.");
  }
  return brief;
}

export function formatBriefMarkdown(brief: CreativeBrief): string {
  const c = brief.selected;
  const lines = [
    `# NyumbaSearch creative brief — ${c.name}`,
    "",
    `**Concept ID:** \`${c.id}\` (${c.letter})`,
    `**Format:** ${c.format}`,
    `**Objective:** ${c.objective}`,
    `**Audience:** ${c.audience}`,
    `**Funnel:** ${c.funnel}`,
    `**Score:** ${brief.scores.total}/100 · Viral ${brief.scores.viralScore} · Business ${brief.scores.businessScore}`,
    "",
    "## Why this (not a catalogue post)",
    c.nyumbaSpin,
    "",
    "## Inspiration mechanisms (do not copy creatives)",
    ...c.inspirationNotes.map((n) => `- ${n}`),
    "",
    "## Spec card",
    "```",
    `OBJECTIVE: ${c.objective}`,
    `AUDIENCE: ${c.audience}`,
    `SEARCH INTENT: ${c.searchIntent}`,
    `HOOK: ${c.hook}`,
    `CONTENT FORMAT: ${c.format}`,
    `KEY MESSAGE: ${c.keyMessage}`,
    `CTA: ${c.cta}`,
    `EXPECTED ACTION: ${c.expectedAction}`,
    `DESTINATION: ${brief.destinationUrl}`,
    "```",
    "",
    "## Fatigues detected",
    ...(brief.fatigue.length ? brief.fatigue.map((f) => `- ${f}`) : ["- None"]),
    "",
    "## Quality gate",
    brief.quality.pass ? "PASS" : "NEEDS WORK",
    ...brief.quality.reasons.map((r) => `- ${r}`),
    "",
    "## Caption",
    brief.caption,
    "",
  ];
  if (brief.reel) {
    lines.push(
      "## Reel package",
      `**Hook 1–3s:** ${brief.reel.hook1to3s}`,
      "",
      "### Script",
      ...brief.reel.script.map((s) => `- ${s}`),
      "",
      "### Shot list",
      ...brief.reel.shotList.map((s) => `- ${s}`),
      "",
      `**Audio:** ${brief.reel.audioDirection}`,
      `**Ending:** ${brief.reel.ending}`,
      "",
    );
  }
  lines.push(
    "## Alternatives scored",
    ...brief.alternatives.map(
      (a) =>
        `- **${a.concept.letter}. ${a.concept.name}** — ${a.scores.total}/100 (biz ${a.scores.businessScore})`,
    ),
    "",
    "## Warnings",
    ...(brief.warnings.length ? brief.warnings.map((w) => `- ${w}`) : ["- None"]),
    "",
    "> Golden rule: interesting enough to share *and* a reason to use NyumbaSearch.",
  );
  return lines.join("\n");
}
