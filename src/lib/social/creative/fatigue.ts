import type { ContentPostRecord } from "./types";

const CATALOGUE_TAGS = new Set(["listing_tour", "generic_listing", "dream_home", "download_app"]);

export function detectFatigue(posts: ContentPostRecord[], lookback = 8): string[] {
  const recent = posts
    .filter((p) => p.status === "published" || p.status === "draft")
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, lookback);

  const flags: string[] = [];
  const topics = recent.map((p) => p.topic.toLowerCase());
  const formats = recent.map((p) => p.content_type);
  const hooks = recent.map((p) => p.hook.toLowerCase());

  const tourCount = recent.filter((p) =>
    /tour|listing|bedroom|apartment available/i.test(`${p.topic} ${p.hook}`),
  ).length;
  if (tourCount >= 3) {
    flags.push(
      "Catalogue fatigue: several recent posts are listing/tour-shaped. Pivot away from exterior→rooms→CTA.",
    );
  }

  const uniqueFormats = new Set(formats);
  if (recent.length >= 4 && uniqueFormats.size <= 2) {
    flags.push(
      "Format fatigue: feed is stuck in 1–2 formats. Mix carousel, POV, education, or product demo.",
    );
  }

  const genericHooks = hooks.filter((h) =>
    /beautiful apartment|2 bedroom apartment for rent|download nyumbasearch|find your dream home/i.test(
      h,
    ),
  ).length;
  if (genericHooks >= 2) {
    flags.push("Hook fatigue: generic listing/download language. Need a stronger mechanism.");
  }

  const locationCounts = new Map<string, number>();
  for (const p of recent) {
    if (!p.location) continue;
    locationCounts.set(p.location, (locationCounts.get(p.location) ?? 0) + 1);
  }
  for (const [loc, n] of locationCounts) {
    if (n >= 3)
      flags.push(`Location fatigue: ${loc} appeared ${n} times in the last ${lookback} items.`);
  }

  const tagHits = recent.filter((p) => CATALOGUE_TAGS.has(p.visual_style)).length;
  if (tagHits >= 3) {
    flags.push("Visual fatigue: repeated catalogue styling.");
  }

  if (topics.filter((t) => t.includes("area guide") || t.includes("living in")).length >= 3) {
    flags.push(
      "Area-guide cluster: neighbourhood explainers recently used. Prefer a different pillar.",
    );
  }

  return flags;
}

export function conceptRecentlyUsed(
  posts: ContentPostRecord[],
  conceptId: string,
  days = 14,
): boolean {
  const cutoff = Date.now() - days * 86400000;
  return posts.some((p) => {
    const t = Date.parse(p.date);
    if (Number.isNaN(t) || t < cutoff) return false;
    return (
      p.notes.includes(`concept:${conceptId}`) ||
      p.topic.toLowerCase().includes(conceptId.toLowerCase())
    );
  });
}
