/**
 * Official NyumbaSearch social profiles — env overrides defaults.
 * Defaults are verified official channels (never invent URLs).
 * Empty strings are omitted from footer links and Organization `sameAs`.
 */
export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "linkedin"
  | "x"
  | "whatsapp";

export type SocialProfile = {
  platform: SocialPlatform;
  /** Public profile or channel URL */
  url: string;
  /** Display label for accessibility */
  label: string;
  /** Suggested display name for profile setup (not used as URL) */
  displayNameHint: string;
  /** Suggested bio snippet for profile setup */
  bioHint: string;
};

const ENV_KEYS: Record<SocialPlatform, string> = {
  instagram: "VITE_SOCIAL_INSTAGRAM",
  tiktok: "VITE_SOCIAL_TIKTOK",
  youtube: "VITE_SOCIAL_YOUTUBE",
  facebook: "VITE_SOCIAL_FACEBOOK",
  linkedin: "VITE_SOCIAL_LINKEDIN",
  x: "VITE_SOCIAL_X",
  whatsapp: "VITE_SOCIAL_WHATSAPP",
};

/** Canonical official profiles (tracking params stripped). Env overrides these. */
export const OFFICIAL_SOCIAL_URLS: Record<SocialPlatform, string> = {
  instagram: "https://www.instagram.com/nyumbasearch_/",
  tiktok: "https://www.tiktok.com/@nyumbasearch",
  youtube: "https://www.youtube.com/@nyumbasearch",
  facebook: "https://www.facebook.com/share/1E1M8jDjsg/",
  linkedin: "https://www.linkedin.com/company/nyumbasearch",
  x: "https://x.com/nyumbasearch",
  whatsapp: "https://wa.me/254714725598",
};

export const OFFICIAL_TWITTER_HANDLE = "NyumbaSearch";

const TRACKING_PARAMS = new Set([
  "igsi",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "mibextid",
  "si",
  "_r",
  "_t",
  "s",
  "fbclid",
]);

function readEnv(key: string): string {
  if (typeof process !== "undefined" && process.env[key]) {
    return String(process.env[key]).trim();
  }
  const vite = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  return vite?.trim() ?? "";
}

/** Normalize URL and strip social share / tracking query params. */
export function normalizeSocialUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const withScheme = t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    const keysToDelete: string[] = [];
    for (const key of u.searchParams.keys()) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) keysToDelete.push(key);
    }
    for (const key of keysToDelete) u.searchParams.delete(key);
    if (u.searchParams.toString() === "") u.search = "";
    return u.toString();
  } catch {
    return withScheme;
  }
}

function resolveUrl(platform: SocialPlatform): string {
  const fromEnv = normalizeSocialUrl(readEnv(ENV_KEYS[platform]));
  if (fromEnv) return fromEnv;
  return normalizeSocialUrl(OFFICIAL_SOCIAL_URLS[platform]);
}

/** Brand display name for social profile name fields (search-friendly, not stuffed). */
export const SOCIAL_DISPLAY_NAME = "NyumbaSearch | Houses & Apartments Kenya";

/** One-line bio template — operators paste into each platform's bio field. */
export const SOCIAL_BIO_TEMPLATE =
  "Verified rental homes in Nairobi & Kenya. Map search, real listings, no broker spam. Browse nyumbasearch.com";

const PROFILE_META: Record<SocialPlatform, Omit<SocialProfile, "platform" | "url">> = {
  instagram: {
    label: "Instagram",
    displayNameHint: SOCIAL_DISPLAY_NAME,
    bioHint: SOCIAL_BIO_TEMPLATE,
  },
  tiktok: {
    label: "TikTok",
    displayNameHint: SOCIAL_DISPLAY_NAME,
    bioHint: SOCIAL_BIO_TEMPLATE,
  },
  youtube: {
    label: "YouTube",
    displayNameHint: "NyumbaSearch Kenya — Apartments & Houses for Rent",
    bioHint:
      "Apartment tours, neighbourhood guides, and rental tips for Nairobi & Kenya. Find verified listings on nyumbasearch.com",
  },
  facebook: {
    label: "Facebook",
    displayNameHint: SOCIAL_DISPLAY_NAME,
    bioHint: SOCIAL_BIO_TEMPLATE,
  },
  linkedin: {
    label: "LinkedIn",
    displayNameHint: SOCIAL_DISPLAY_NAME,
    bioHint: SOCIAL_BIO_TEMPLATE,
  },
  x: {
    label: "X",
    displayNameHint: SOCIAL_DISPLAY_NAME,
    bioHint: SOCIAL_BIO_TEMPLATE,
  },
  whatsapp: {
    label: "WhatsApp",
    displayNameHint: "NyumbaSearch",
    bioHint: "New listings & rental tips for Nairobi. Browse nyumbasearch.com",
  },
};

/** Configured profiles (official defaults + env overrides). */
export function getConfiguredSocialProfiles(): SocialProfile[] {
  const out: SocialProfile[] = [];
  for (const platform of Object.keys(PROFILE_META) as SocialPlatform[]) {
    const url = resolveUrl(platform);
    if (!url) continue;
    out.push({ platform, url, ...PROFILE_META[platform] });
  }
  return out;
}

/** Organization schema `sameAs` — official social + app store. */
export function getOrganizationSameAs(playStoreUrl: string): string[] {
  const urls = getConfiguredSocialProfiles().map((p) => p.url);
  if (playStoreUrl) urls.push(playStoreUrl);
  return [...new Set(urls)];
}

/** X/Twitter handle for twitter:site meta (without @). */
export function getTwitterSiteHandle(): string {
  const raw = readEnv("VITE_TWITTER_HANDLE").replace(/^@/, "").trim();
  return raw || OFFICIAL_TWITTER_HANDLE;
}
