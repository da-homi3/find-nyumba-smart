import { getSiteUrl } from "@/lib/site";
import { areaPathForName } from "@/lib/seo/areas";
import { propertyTypeLabel, tieredHashtags } from "@/lib/social/keywords";

export type SocialPlatformFormat =
  | "instagram_reel"
  | "instagram_carousel"
  | "tiktok"
  | "youtube_short"
  | "youtube_long"
  | "facebook_reel"
  | "facebook_post"
  | "linkedin"
  | "x"
  | "whatsapp_status";

export type PropertySocialInput = {
  title: string;
  propertyType: string;
  neighborhood: string;
  bedrooms?: number;
  rentKes?: number;
  amenities?: string[];
  propertyId?: string;
  /** Verified only — do not claim if false */
  isVerified?: boolean;
  /** UTM source override, e.g. instagram | tiktok | share */
  utmSource?: string;
  utmCampaign?: string;
};

export type SocialContentPackage = {
  searchKeyword: string;
  videoTitle: string;
  hook: string;
  spokenKeywords: string[];
  onScreenText: string[];
  caption: string;
  description: string;
  hashtags: string[];
  locationTag: string;
  cta: string;
  destinationUrl: string;
};

/** Append social attribution UTMs without duplicating existing query params. */
export function appendSocialUtm(
  url: string,
  options?: { source?: string; medium?: string; campaign?: string; content?: string },
): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("utm_source")) {
      u.searchParams.set("utm_source", options?.source ?? "social");
    }
    if (!u.searchParams.has("utm_medium")) {
      u.searchParams.set("utm_medium", options?.medium ?? "social");
    }
    if (!u.searchParams.has("utm_campaign")) {
      u.searchParams.set("utm_campaign", options?.campaign ?? "property_share");
    }
    if (options?.content && !u.searchParams.has("utm_content")) {
      u.searchParams.set("utm_content", options.content);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

function destinationFor(input: PropertySocialInput): string {
  const site = getSiteUrl();
  let base: string;
  if (input.propertyId) base = `${site}/tenant/property/${input.propertyId}`;
  else {
    const areaPath = areaPathForName(input.neighborhood);
    base = areaPath
      ? `${site}${areaPath}`
      : `${site}/tenant?q=${encodeURIComponent(input.neighborhood)}`;
  }
  return appendSocialUtm(base, {
    source: input.utmSource ?? "social",
    campaign: input.utmCampaign ?? "property_share",
    content: input.neighborhood.toLowerCase().replaceAll(/\s+/g, "-"),
  });
}

/**
 * Story-first property video storyboard (not exterior→lobby→rooms catalogue).
 * Seconds are guidance for editors. Always ground rent/availability in a live listing.
 */
export const PROPERTY_VIDEO_STORYBOARD = [
  {
    startSec: 0,
    endSec: 3,
    beat: "Cold open: strongest story hook (hero feature, price curiosity, or POV — not a wide exterior)",
  },
  {
    startSec: 3,
    endSec: 8,
    beat: "Context: neighbourhood + who this home is for (spoken + on-screen)",
  },
  {
    startSec: 8,
    endSec: 18,
    beat: "Reveal the most impressive feature first (view, garden, light, kitchen, etc.)",
  },
  { startSec: 18, endSec: 32, beat: "Living experience: how the space feels day-to-day" },
  { startSec: 32, endSec: 42, beat: "Bedrooms / baths only as needed for the story" },
  {
    startSec: 42,
    endSec: 52,
    beat: "Amenities + security/water/internet if they change the decision",
  },
  { startSec: 52, endSec: 60, beat: "Location / commute punchline" },
  {
    startSec: 60,
    endSec: 70,
    beat: "Value close (only verified rent) + CTA: Find this property on NyumbaSearch",
  },
] as const;

/**
 * Generate SEO-ready social metadata for a property post.
 * Human review required before publish — especially rent, availability, and verification claims.
 */
export function buildPropertySocialPackage(input: PropertySocialInput): SocialContentPackage {
  const typeLabel = propertyTypeLabel(input.propertyType);
  const beds = input.bedrooms != null && input.bedrooms > 0 ? `${input.bedrooms} bedroom ` : "";
  const searchKeyword = `${beds}${typeLabel} in ${input.neighborhood}`.trim();
  const videoTitle = `${beds}${typeLabel.charAt(0).toUpperCase()}${typeLabel.slice(1)} Tour in ${input.neighborhood} Nairobi | NyumbaSearch`;
  const hook = `Looking for a ${beds}${typeLabel} in ${input.neighborhood}?`;
  const rentLine =
    input.rentKes != null && input.rentKes > 0
      ? `Rent from ${formatKes(input.rentKes)} per month.`
      : "";
  const verifyLine = input.isVerified ? "Verified listing on NyumbaSearch." : "";
  const amenityLines = (input.amenities ?? []).slice(0, 4).map((a) => `• ${a}`);
  const destinationUrl = destinationFor(input);
  const tags = tieredHashtags(input.neighborhood);
  const hashtags = [
    ...tags.brand,
    ...tags.category.slice(0, 2),
    ...tags.location.slice(0, 2),
    ...tags.intent.slice(0, 1),
  ];

  let bedroomLine = "";
  if (input.bedrooms != null) {
    const plural = input.bedrooms === 1 ? "" : "s";
    bedroomLine = `🛏 ${input.bedrooms} bedroom${plural}`;
  }
  const captionLines = [
    hook,
    "",
    input.title,
    rentLine,
    verifyLine,
    "",
    `📍 ${input.neighborhood}, Nairobi`,
    bedroomLine,
    ...amenityLines,
    "",
    "Explore this property on NyumbaSearch 👇",
    destinationUrl,
    "",
    hashtags.join(" "),
  ].filter(Boolean);

  const description = [
    videoTitle,
    "",
    `${hook} ${rentLine}`.trim(),
    "",
    `Location: ${input.neighborhood}, Nairobi, Kenya`,
    input.bedrooms != null ? `Bedrooms: ${input.bedrooms}` : "",
    input.rentKes != null ? `Rent: ${formatKes(input.rentKes)}/month` : "",
    "",
    "Browse verified rentals: " + getSiteUrl(),
    "Property link: " + destinationUrl,
    "",
    hashtags.join(" "),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    searchKeyword,
    videoTitle,
    hook,
    spokenKeywords: [searchKeyword, input.neighborhood, "Nairobi", "NyumbaSearch", typeLabel],
    onScreenText: [input.neighborhood, typeLabel, beds.trim()].filter(Boolean),
    caption: captionLines.join("\n"),
    description,
    hashtags,
    locationTag: `${input.neighborhood}, Nairobi`,
    cta: "Find this property on NyumbaSearch",
    destinationUrl,
  };
}

export type LocationGuideInput = {
  areaName: string;
  slug: string;
  highlights?: string[];
};

/** Location guide content (Pillar 2) — links to /areas/{slug}. */
export function buildLocationGuidePackage(input: LocationGuideInput): SocialContentPackage {
  const site = getSiteUrl();
  const destinationUrl = appendSocialUtm(`${site}/areas/${input.slug}`, {
    source: "social",
    campaign: "location_guide",
    content: input.slug,
  });
  const searchKeyword = `living in ${input.areaName} Nairobi`;
  const videoTitle = `Living in ${input.areaName}: What You Need to Know | NyumbaSearch`;
  const hook = `Thinking of moving to ${input.areaName}?`;
  const tags = tieredHashtags(input.areaName);
  const hashtags = [
    ...tags.brand,
    ...tags.category.slice(0, 1),
    ...tags.location,
    "#MovingToNairobi",
  ];

  const bullets = (
    input.highlights ?? [
      "Commute & access",
      "Typical rent range (check live listings)",
      "Who it suits",
      "Safety & amenities",
    ]
  ).map((h) => `• ${h}`);

  const caption = [
    hook,
    "",
    ...bullets,
    "",
    `See available homes in ${input.areaName}:`,
    destinationUrl,
    "",
    hashtags.join(" "),
  ].join("\n");

  return {
    searchKeyword,
    videoTitle,
    hook,
    spokenKeywords: [input.areaName, "Nairobi", "rent", "NyumbaSearch"],
    onScreenText: [input.areaName, "Nairobi"],
    caption,
    description: caption,
    hashtags,
    locationTag: `${input.areaName}, Nairobi`,
    cta: `Browse ${input.areaName} listings`,
    destinationUrl,
  };
}

/** 30-day content calendar seed — operators extend in CMS/spreadsheet. */
export type ContentCalendarEntry = {
  day: number;
  pillar: string;
  platform: SocialPlatformFormat;
  topic: string;
  targetKeyword: string;
  searchIntent: "transactional" | "informational" | "brand" | "product";
  format: string;
  hook: string;
  cta: string;
  destinationPattern: string;
};

function calendarPlatform(day: number): SocialPlatformFormat {
  if (day % 3 === 0) return "youtube_short";
  if (day % 2 === 0) return "instagram_reel";
  return "tiktok";
}

function calendarTopic(pillar: string, area: string): string {
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

function calendarHook(pillar: string, area: string): string {
  if (pillar === "Location Guides") return `Is ${area} right for you?`;
  return `New listing in ${area}`;
}

export function build30DayContentCalendarSeed(): ContentCalendarEntry[] {
  const areas = ["Kilimani", "Westlands", "Karen", "Kileleshwa", "South B", "Kasarani"];
  const entries: ContentCalendarEntry[] = [];
  const pillars = [
    { pillar: "Property Discovery", format: "Apartment tour", intent: "transactional" as const },
    { pillar: "Location Guides", format: "Area guide", intent: "informational" as const },
    { pillar: "Education", format: "Rental tip", intent: "informational" as const },
    { pillar: "Product Education", format: "How-to", intent: "product" as const },
    { pillar: "Trust", format: "Verified listing", intent: "brand" as const },
  ];

  for (let day = 1; day <= 30; day += 1) {
    const p = pillars[(day - 1) % pillars.length]!;
    const area = areas[(day - 1) % areas.length]!;
    const slug = area.toLowerCase().replaceAll(/\s+/g, "-");
    const isLocation = p.pillar === "Location Guides";
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
      destinationPattern: isLocation ? `/areas/${slug}` : `/tenant?q=${encodeURIComponent(area)}`,
    });
  }
  return entries;
}
