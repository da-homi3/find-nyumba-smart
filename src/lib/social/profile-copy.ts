/**
 * Ready-to-paste bios, display names, and pinned posts for official NyumbaSearch profiles.
 * Operators apply these in each platform’s settings (not rendered on the public website).
 */
import {
  OFFICIAL_SOCIAL_URLS,
  SOCIAL_BIO_TEMPLATE,
  SOCIAL_DISPLAY_NAME,
} from "@/lib/social/profiles";

export type PlatformProfileCopy = {
  platform: string;
  /** Key matching OFFICIAL_SOCIAL_URLS when applicable */
  profileKey?: keyof typeof OFFICIAL_SOCIAL_URLS;
  displayName: string;
  bio: string;
  website: string;
  profileUrl: string;
  pinnedPost?: string;
  notes?: string[];
};

const SITE = "https://nyumbasearch.com";
const TENANT = `${SITE}/tenant`;

export const PLATFORM_PROFILE_COPY: PlatformProfileCopy[] = [
  {
    platform: "Instagram",
    profileKey: "instagram",
    displayName: SOCIAL_DISPLAY_NAME,
    bio: SOCIAL_BIO_TEMPLATE,
    website: TENANT,
    profileUrl: OFFICIAL_SOCIAL_URLS.instagram,
    pinnedPost: `Looking for a house or apartment in Nairobi?

NyumbaSearch shows verified rentals on a map — Kilimani, Westlands, Karen, Kasarani and more.

Search free → ${TENANT}?utm_source=instagram&utm_medium=social&utm_campaign=pinned

#NyumbaSearch #NairobiApartments #HouseHunting #RentInNairobi`,
    notes: [
      "Open Edit profile → paste Display name + Bio + Website",
      "Category: Real Estate / Property · Location: Nairobi, Kenya",
      "Post the pinned caption, then Pin to profile",
    ],
  },
  {
    platform: "TikTok",
    profileKey: "tiktok",
    displayName: SOCIAL_DISPLAY_NAME,
    bio: "Verified Nairobi rentals · Map search · No broker spam ↓",
    website: TENANT,
    profileUrl: OFFICIAL_SOCIAL_URLS.tiktok,
    pinnedPost: `House hunting in Nairobi shouldn't mean fake listings and wasted trips.

Search verified apartments & houses on NyumbaSearch.

📍 Nairobi & Kenya
🔗 ${TENANT}?utm_source=tiktok&utm_medium=social&utm_campaign=pinned

#NyumbaSearch #Nairobi #ApartmentHunting`,
    notes: [
      "Edit profile → Name + Bio + Website",
      "Speak location + property type in the first 3 seconds of every video",
    ],
  },
  {
    platform: "YouTube",
    profileKey: "youtube",
    displayName: "NyumbaSearch Kenya — Apartments & Houses for Rent",
    bio: `NyumbaSearch is Kenya’s map-first rental marketplace.

Apartment tours, neighbourhood guides, and rental tips for Nairobi & beyond.
Browse verified listings: ${SITE}

Contact: nyumbasearch101@gmail.com`,
    website: SITE,
    profileUrl: OFFICIAL_SOCIAL_URLS.youtube,
    pinnedPost: `Your next home is just one search away | NyumbaSearch

House hunting in Nairobi shouldn’t mean endless calls, fake listings, or uncertainty about who to trust.

Search verified rentals: ${TENANT}?utm_source=youtube&utm_medium=social&utm_campaign=channel

Subscribe for area guides (Kilimani, Westlands, Karen…) and apartment tours.`,
    notes: [
      "Customize channel → Name + Description + Links",
      "Playlists: By neighbourhood · By bedrooms · Rental education",
    ],
  },
  {
    platform: "Facebook",
    profileKey: "facebook",
    displayName: SOCIAL_DISPLAY_NAME,
    bio: SOCIAL_BIO_TEMPLATE,
    website: SITE,
    profileUrl: OFFICIAL_SOCIAL_URLS.facebook,
    pinnedPost: `NyumbaSearch — verified houses & apartments for rent in Nairobi.

Browse the map, filter by neighbourhood and budget, contact verified listers.

Start here: ${TENANT}?utm_source=facebook&utm_medium=social&utm_campaign=pinned`,
    notes: [
      "Page settings → About → paste bio + website",
      "When Meta issues a vanity URL, update VITE_SOCIAL_FACEBOOK",
    ],
  },
  {
    platform: "X",
    profileKey: "x",
    displayName: SOCIAL_DISPLAY_NAME,
    bio: SOCIAL_BIO_TEMPLATE,
    website: SITE,
    profileUrl: OFFICIAL_SOCIAL_URLS.x,
    pinnedPost: `House hunting in Nairobi shouldn’t mean fake listings and wasted trips.

NyumbaSearch: verified rentals, map search, direct contact.

→ ${TENANT}?utm_source=x&utm_medium=social&utm_campaign=pinned

#NyumbaSearch #Nairobi #HouseHunting`,
    notes: ["Edit profile → Name + Bio + Website", "Post then Pin to profile"],
  },
  {
    platform: "LinkedIn (Founder)",
    profileKey: "linkedin",
    displayName: "Kevin Buluma — Co-founder & Engineering, NyumbaSearch",
    bio: `Building NyumbaSearch — Kenyan proptech for verified rental discovery and property management.

Map-first search · Direct listers · Tenant & landlord tools · Nairobi & Kenya

${SITE}`,
    website: SITE,
    profileUrl: OFFICIAL_SOCIAL_URLS.linkedin,
    pinnedPost: `We’re building NyumbaSearch so Kenyans can find verified homes without broker spam or ghost listings.

Proptech for Nairobi rentals: map search, verified owners, and tools for landlords and property managers.

Explore: ${SITE}?utm_source=linkedin&utm_medium=social&utm_campaign=founder`,
    notes: [
      "Update About + Featured on founder profile",
      "Create a Company Page when ready for brand entity",
    ],
  },
  {
    platform: "WhatsApp",
    profileKey: "whatsapp",
    displayName: "NyumbaSearch",
    bio: "Customer care & listing help. Browse nyumbasearch.com",
    website: OFFICIAL_SOCIAL_URLS.whatsapp,
    profileUrl: OFFICIAL_SOCIAL_URLS.whatsapp,
    notes: [
      "Business profile name + short description",
      "Consider a Channel for weekly new-listing digests by area",
    ],
  },
];

/** Week-1 publish pack — copy into each platform (adapt length per network). */
export type Week1SocialPost = {
  day: number;
  pillar: string;
  platforms: string[];
  topic: string;
  targetKeyword: string;
  hook: string;
  caption: string;
  destinationUrl: string;
};

export function buildWeek1PublishPack(): Week1SocialPost[] {
  const areas = [
    { name: "Kilimani", slug: "kilimani" },
    { name: "Westlands", slug: "westlands" },
    { name: "Karen", slug: "karen" },
    { name: "Kasarani", slug: "kasarani" },
    { name: "Kileleshwa", slug: "kileleshwa" },
    { name: "Parklands", slug: "parklands" },
    { name: "South B", slug: "south-b" },
  ];
  return areas.map((area, i) => {
    const day = i + 1;
    const destinationUrl = `${SITE}/areas/${area.slug}?utm_source=social&utm_medium=social&utm_campaign=week1&utm_content=${area.slug}`;
    const isGuide = day % 2 === 0;
    return {
      day,
      pillar: isGuide ? "Location Guides" : "Property Discovery",
      platforms: ["Instagram Reel", "TikTok", "YouTube Short", "Facebook Reel"],
      topic: isGuide ? `Living in ${area.name}` : `${area.name} apartment tour`,
      targetKeyword: `apartments for rent in ${area.name}`,
      hook: isGuide
        ? `Thinking of moving to ${area.name}?`
        : `Looking for an apartment in ${area.name}?`,
      caption: [
        isGuide
          ? `Thinking of moving to ${area.name}, Nairobi?`
          : `Looking for apartments for rent in ${area.name}?`,
        "",
        isGuide
          ? `Commute, lifestyle, and who ${area.name} suits — then browse live verified listings.`
          : `Tour-style tips for finding a verified home in ${area.name} on NyumbaSearch.`,
        "",
        `📍 ${area.name}, Nairobi`,
        `Browse → ${destinationUrl}`,
        "",
        `#NyumbaSearch #${area.name.replaceAll(/\s+/g, "")} #NairobiApartments #HouseHunting #RentInNairobi`,
      ].join("\n"),
      destinationUrl,
    };
  });
}

/** Flat markdown for docs / Notion paste. */
export function formatProfileCopyMarkdown(): string {
  const blocks = PLATFORM_PROFILE_COPY.map((p) => {
    const notes = (p.notes ?? []).map((n) => `- ${n}`).join("\n");
    return [
      `## ${p.platform}`,
      "",
      `**Profile:** ${p.profileUrl}`,
      "",
      `**Display name:** ${p.displayName}`,
      "",
      `**Bio:**`,
      p.bio,
      "",
      `**Website:** ${p.website}`,
      p.pinnedPost ? `\n**Pinned / first post:**\n\n${p.pinnedPost}\n` : "",
      notes ? `\n**Notes:**\n${notes}` : "",
    ].join("\n");
  });
  return `# NyumbaSearch — Social profile copy pack\n\nPaste into each platform’s settings.\n\n${blocks.join("\n\n---\n\n")}\n`;
}
