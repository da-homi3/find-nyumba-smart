import type { Property } from "@/lib/properties";

export const LISTING_STATUS_CONFIG = {
  published: {
    color: "var(--status-published)",
    label: "Live",
    icon: "●",
  },
  pending_review: {
    color: "var(--status-pending)",
    label: "In review",
    icon: "◐",
  },
  draft: {
    color: "var(--status-draft)",
    label: "Draft",
    icon: "○",
  },
  rejected: {
    color: "var(--status-rejected)",
    label: "Needs changes",
    icon: "✕",
  },
  rented: {
    color: "var(--status-rented)",
    label: "Rented",
    icon: "🔑",
  },
  archived: {
    color: "var(--status-archived)",
    label: "Archived",
    icon: "▢",
  },
} as const;

export type ListingStatus = keyof typeof LISTING_STATUS_CONFIG;

export type ListingStatusConfig = (typeof LISTING_STATUS_CONFIG)[ListingStatus];

/** Map DB property fields to a dashboard status key. */
export function resolveListingStatus(
  property: Pick<Property, "is_active" | "is_verified" | "is_vacant">,
): ListingStatus {
  if (!property.is_active) {
    if (property.is_vacant === false) return "rented";
    return "archived";
  }
  if (!property.is_verified) return "pending_review";
  return "published";
}

export function getListingStatusConfig(
  property: Pick<Property, "is_active" | "is_verified" | "is_vacant">,
): ListingStatusConfig {
  return LISTING_STATUS_CONFIG[resolveListingStatus(property)];
}

export type ReviewPriority = "flagged" | "priority" | "routine";

export const REVIEW_PRIORITY_CONFIG = {
  flagged: {
    color: "var(--status-rejected)",
    label: "Needs review",
    border: "2px solid color-mix(in srgb, var(--status-rejected) 27%, transparent)",
    bg: "color-mix(in srgb, var(--status-rejected) 4%, transparent)",
  },
  priority: {
    color: "var(--status-pending)",
    label: "Premium listing",
    border: "1px solid color-mix(in srgb, var(--status-pending) 20%, transparent)",
    bg: "var(--surface-1)",
  },
  routine: {
    color: "rgba(255,255,255,0.3)",
    label: "",
    border: "1px solid rgba(255,255,255,0.06)",
    bg: "var(--surface-1)",
  },
} as const;

/** Admin triage: low authenticity = flagged; Nyumba-verified = priority. */
export function resolveReviewPriority(
  property: Pick<Property, "authenticity_score" | "nyumba_verified_at" | "is_verified">,
): ReviewPriority {
  const score = property.authenticity_score ?? 70;
  const fraudScore = Math.max(0, 100 - score);
  if (fraudScore >= 40) return "flagged";
  if (property.nyumba_verified_at || property.is_verified) return "priority";
  return "routine";
}

export function reviewPrioritySort<
  T extends Pick<
    Property,
    "authenticity_score" | "nyumba_verified_at" | "is_verified" | "updated_at"
  >,
>(items: T[]): T[] {
  const weight = (p: T) => {
    const pr = resolveReviewPriority(p);
    if (pr === "flagged") return 0;
    if (pr === "priority") return 1;
    return 2;
  };
  return [...items].sort((a, b) => {
    const w = weight(a) - weight(b);
    if (w !== 0) return w;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}
