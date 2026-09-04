import type { CreativeBrief, CreativeConcept, QualityGateResult } from "./types";

type GateAnswer = "yes" | "weak" | "no";

const LISTING_PATH_RE = /\/tenant\/property\/[0-9a-f-]{8,}/i;
const MONEY_UNIT_RE = /\b(?:ksh|kes)\b/i;

function captionMentionsMoney(caption: string): boolean {
  if (!MONEY_UNIT_RE.test(caption) && !/\bk\b/i.test(caption)) return false;
  // Digit then optional separators before a money unit — bounded to avoid catastrophic backtracking.
  return /\d[\d,]{0,12}\s{0,3}(?:ksh|kes|k)\b/i.test(caption);
}

function yesWeak(ok: boolean): GateAnswer {
  return ok ? "yes" : "weak";
}

function yesNo(ok: boolean): GateAnswer {
  return ok ? "yes" : "no";
}

function accuracyAnswer(concept: CreativeConcept, hasLiveListing: boolean): GateAnswer {
  if (!concept.requiresVerifiedFacts) return "yes";
  return hasLiveListing ? "yes" : "weak";
}

function buildAnswers(
  concept: CreativeConcept,
  hasLiveListing: boolean,
): QualityGateResult["answers"] {
  const hookBlob = `${concept.hook} ${concept.keyMessage}`;
  const brandBlob = `${concept.cta} ${concept.nyumbaSpin}`.toLowerCase();

  return {
    attention: yesWeak(
      concept.hook.length > 12 && !/dream home|beautiful apartment available/i.test(concept.hook),
    ),
    value: yesWeak(concept.keyMessage.length > 20),
    emotion: yesWeak(/pov|when |don't |stop |wait|would you/i.test(concept.hook)),
    relevance: yesNo(
      /rent|house|apartment|landlord|deposit|neighbour|nairobi|list|map|move/i.test(hookBlob),
    ),
    brand: yesWeak(/nyumba|verified|map|broker/i.test(brandBlob)),
    differentiation: yesNo(!/2 bedroom apartment for rent\.?$/i.test(concept.hook)),
    lead: yesWeak(concept.funnel !== "AWARENESS" || concept.objective !== "engagement"),
    search: yesWeak(concept.searchIntent.length > 8),
    culture: yesWeak(concept.kenyanContext.length > 10),
    accuracy: accuracyAnswer(concept, hasLiveListing),
  };
}

export function runQualityGate(
  concept: CreativeConcept,
  caption: string,
  destinationUrl = "",
): QualityGateResult {
  const hasLiveListing = LISTING_PATH_RE.test(destinationUrl) || LISTING_PATH_RE.test(caption);
  const answers = buildAnswers(concept, hasLiveListing);

  const reasons: string[] = [];
  for (const [k, v] of Object.entries(answers)) {
    if (v === "no") reasons.push(`Failed: ${k}`);
    if (v === "weak") reasons.push(`Weak: ${k}`);
  }

  const weakOrNo = Object.values(answers).filter((v) => v !== "yes").length;
  return {
    pass: weakOrNo <= 3 && answers.relevance !== "no" && answers.differentiation !== "no",
    answers,
    reasons,
  };
}

export function assertBriefSafe(brief: CreativeBrief): string[] {
  const warnings: string[] = [...brief.warnings];
  if (brief.selected.requiresVerifiedFacts && !brief.destinationUrl.includes("/tenant/property/")) {
    warnings.push(
      "This concept needs a live listing URL with real price/photos before publish. Do not invent KSh or amenities.",
    );
  }
  if (captionMentionsMoney(brief.caption) && brief.selected.requiresVerifiedFacts) {
    warnings.push("Caption mentions money — human-verify against the live listing before publish.");
  }
  return warnings;
}
