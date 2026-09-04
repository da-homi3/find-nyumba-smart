/**
 * Export social SEO keyword matrix + 30-day calendar for operators.
 * Usage: npm run export:social-plan [-- --out=docs/social-content-plan.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.find((a) => a.startsWith("--out="))?.slice(6);
const outPath = outArg ?? join(root, "docs", "social-content-plan.json");

const staticRoutes = JSON.parse(readFileSync(join(root, "src/lib/seo/staticRoutes.json"), "utf8"));
const geoAreas = staticRoutes.geoAreas ?? [];
const site = (
  process.env.PUBLIC_APP_URL ??
  process.env.SITE_URL ??
  "https://nyumbasearch.com"
).replace(/\/$/, "");

function locationKeyword(typeLabel, areaName) {
  return `${typeLabel} for rent in ${areaName}`;
}

function buildLocationKeywordMatrix(areas, types, max) {
  const out = [];
  for (const area of areas) {
    for (const type of types) {
      if (out.length >= max) return out;
      out.push({
        keyword: locationKeyword(type, area.name),
        area: area.name,
        slug: area.slug,
        type,
      });
    }
  }
  return out;
}

function calendarPlatform(day) {
  if (day % 3 === 0) return "youtube_short";
  if (day % 2 === 0) return "instagram_reel";
  return "tiktok";
}

function calendarTopic(pillar, area) {
  switch (pillar) {
    case "Location Guides":
      return `Living in ${area}`;
    case "Property Discovery":
      return `${area} apartment tour`;
    case "Education":
      return "Rental checklist Nairobi";
    case "Product Education":
      return "How to search on NyumbaSearch";
    default:
      return "Why verified listings matter";
  }
}

function calendarHook(pillar, area) {
  if (pillar === "Location Guides") return `Is ${area} right for you?`;
  return `New listing in ${area}`;
}

function build30DayContentCalendarSeed() {
  const areas = ["Kilimani", "Westlands", "Karen", "Kileleshwa", "South B", "Kasarani"];
  const pillars = [
    { pillar: "Property Discovery", format: "Apartment tour", intent: "transactional" },
    { pillar: "Location Guides", format: "Area guide", intent: "informational" },
    { pillar: "Education", format: "Rental tip", intent: "informational" },
    { pillar: "Product Education", format: "How-to", intent: "product" },
    { pillar: "Trust", format: "Verified listing", intent: "brand" },
  ];
  const entries = [];
  for (let day = 1; day <= 30; day += 1) {
    const p = pillars[(day - 1) % pillars.length];
    const area = areas[(day - 1) % areas.length];
    const slug = area.toLowerCase().replaceAll(/\s+/g, "-");
    const isLocation = p.pillar === "Location Guides";
    const tenantQuery = `/tenant?q=${encodeURIComponent(area)}`;
    entries.push({
      day,
      pillar: p.pillar,
      platform: calendarPlatform(day),
      topic: calendarTopic(p.pillar, area),
      targetKeyword: isLocation ? `apartments for rent in ${area}` : `houses for rent in ${area}`,
      searchIntent: p.intent,
      format: p.format,
      hook: calendarHook(p.pillar, area),
      cta: "Browse on NyumbaSearch",
      destinationPattern: isLocation ? `/areas/${slug}` : tenantQuery,
      destinationUrl: isLocation ? `${site}/areas/${slug}` : `${site}${tenantQuery}`,
    });
  }
  return entries;
}

const keywords = buildLocationKeywordMatrix(
  geoAreas.slice(0, 40),
  ["apartment", "2 bedroom", "bedsitter", "house"],
  120,
);
const calendar = build30DayContentCalendarSeed();

const payload = {
  generatedAt: new Date().toISOString(),
  site,
  keywordMatrix: keywords,
  calendar30: calendar,
  profileSetup: {
    displayName: "NyumbaSearch | Houses & Apartments Kenya",
    bio: "Verified rental homes in Nairobi & Kenya. Map search, real listings, no broker spam. Browse nyumbasearch.com",
    envVars: [
      "VITE_SOCIAL_INSTAGRAM",
      "VITE_SOCIAL_TIKTOK",
      "VITE_SOCIAL_YOUTUBE",
      "VITE_SOCIAL_FACEBOOK",
      "VITE_SOCIAL_LINKEDIN",
      "VITE_SOCIAL_X",
      "VITE_SOCIAL_WHATSAPP",
      "VITE_TWITTER_HANDLE",
    ],
  },
  notes: [
    "Human review required before publish — verify rent, availability, and location.",
    "Only post area content when inventory meets SEO thresholds on nyumbasearch.com/areas.",
    "Use buildPropertySocialPackage() in src/lib/social/content-engine.ts for listing posts.",
  ],
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`Wrote ${outPath} (${keywords.length} keywords, ${calendar.length} calendar days)`);
