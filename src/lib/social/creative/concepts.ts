import type { CreativeConcept } from "./types";

/**
 * Concept bank: creative *mechanisms*, not copied scripts.
 * Global inspiration is abstracted; Kenyan spin is original.
 */
export const CONCEPT_BANK: CreativeConcept[] = [
  {
    id: "edu-deposit-checks",
    letter: "A",
    name: "3 things to check before you pay a deposit",
    mechanism: "Educational checklist with a cold-open problem (saveable, searchable).",
    inspirationNotes: [
      "Global real-estate: checklist / ‘things I wish I knew’ carousels outperform pure tours.",
      "Finance/SaaS: numbered ‘before you sign’ education drives saves.",
    ],
    nyumbaSpin:
      "House-hunting trauma in Nairobi (fake photos, rushed deposits) → NyumbaSearch as the verified-search next step, not a lecture.",
    format: "carousel",
    objective: "hunter_acquisition",
    audience: "house_hunter",
    funnel: "CONSIDERATION",
    searchIntent: "things to check before renting a house Nairobi",
    hook: "Don't pay a Nairobi deposit until you check these 3 things.",
    keyMessage: "Photos, vacancy, and who you pay matter more than speed.",
    cta: "Search verified listings on NyumbaSearch before you send money.",
    expectedAction: "Open /tenant and search an area they already have in mind.",
    destination:
      "https://nyumbasearch.com/tenant?utm_source=instagram&utm_medium=social&utm_campaign=deposit_checks",
    kenyanContext:
      "Deposit-before-viewing pressure is a real Nairobi hunting pattern — keep it brand-safe, no named villains.",
    requiresVerifiedFacts: false,
    fatigueTags: ["education", "checklist"],
  },
  {
    id: "humour-whatsapp-photos",
    letter: "B",
    name: "When the house looks nothing like the WhatsApp photos",
    mechanism:
      "Relatable comedy / before-after expectation vs reality (UGC energy, original acting or B-roll).",
    inspirationNotes: [
      "Travel/food creators use ‘menu vs plate’ reveals — mechanism is expectation gap, not their footage.",
      "Kenyan X/TikTok already jokes about listing photos; we own the *solution* not the insult.",
    ],
    nyumbaSpin: "Punchline lands on map + verified listings, not dunking on a specific landlord.",
    format: "reel",
    objective: "hunter_acquisition",
    audience: "house_hunter",
    funnel: "AWARENESS",
    searchIntent: "how to avoid rental scams Kenya",
    hook: "When the WhatsApp photos and the actual house are not even cousins.",
    keyMessage: "House hunting shouldn't be a surprise viewing.",
    cta: "Browse real listings on NyumbaSearch — then go view.",
    expectedAction: "Profile visit → website search.",
    destination:
      "https://nyumbasearch.com/tenant?utm_source=tiktok&utm_medium=social&utm_campaign=whatsapp_photos",
    kenyanContext:
      "WhatsApp is how most Nairobi hunting still happens. Humour stays non-defamatory.",
    requiresVerifiedFacts: false,
    fatigueTags: ["humour", "whatsapp"],
  },
  {
    id: "cinematic-value-reveal",
    letter: "C",
    name: "What this rent actually feels like (story reveal)",
    mechanism:
      "Cinematic cold-open on the *best* feature, then price/area — not lobby→bedroom catalogue.",
    inspirationNotes: [
      "Hospitality/luxury: reveal the hero amenity first, then context.",
      "US/UK agents: ‘what $X gets you’ — we only use this when rent is from a live listing.",
    ],
    nyumbaSpin:
      "Only attach a real verified listing. If rent is unknown, drop the number — never invent KSh.",
    format: "property_tour",
    objective: "property_enquiry",
    audience: "house_hunter",
    funnel: "HIGH_INTENT",
    searchIntent: "apartments for rent in Nairobi",
    hook: "Wait until you see why people actually want this unit.",
    keyMessage: "The story is the lifestyle + verified listing, not a room checklist.",
    cta: "Open this listing on NyumbaSearch.",
    expectedAction: "Listing page view / unlock intent.",
    destination: "https://nyumbasearch.com/tenant",
    kenyanContext: "Use Nairobi neighbourhood names from the listing, not generic ‘dream home’.",
    requiresVerifiedFacts: true,
    fatigueTags: ["listing_tour", "cinematic"],
  },
  {
    id: "trend-pov-weekends",
    letter: "D",
    name: "POV: three weekends hunting, then one search",
    mechanism:
      "POV structure (global) localised to Nairobi weekend viewings / matatu time, not copied dialogue.",
    inspirationNotes: [
      "POV formats work because identity + time-pain, not because of a specific creator’s lines.",
      "Sports/tech demos: ‘stop doing it the long way’ product contrast.",
    ],
    nyumbaSpin:
      "Weekend wasted on dead leads vs map search on NyumbaSearch. No fake ‘we found your home in 2 minutes’ claims.",
    format: "pov",
    objective: "hunter_acquisition",
    audience: "house_hunter",
    funnel: "INTEREST",
    searchIntent: "how to find a house in Nairobi",
    hook: "POV: You've already spent three Saturdays house hunting.",
    keyMessage: "The bottleneck is bad inventory, not your effort.",
    cta: "Start on the map — nyumbasearch.com",
    expectedAction: "Website search / app intent.",
    destination:
      "https://nyumbasearch.com/tenant/map?utm_source=instagram&utm_medium=social&utm_campaign=pov_weekends",
    kenyanContext:
      "Saturday viewings + traffic are local; keep slang light unless it fits the speaker naturally.",
    requiresVerifiedFacts: false,
    fatigueTags: ["pov", "product"],
  },
  {
    id: "story-vacant-unit",
    letter: "E",
    name: "Your next tenant is already searching (owners)",
    mechanism:
      "Owner-side story: demand exists, supply is invisible if it's only on a WhatsApp status.",
    inspirationNotes: [
      "SaaS: ‘your customers are already googling’ flipped to landlords.",
      "Marketplace: two-sided story without fake occupancy stats.",
    ],
    nyumbaSpin:
      "Do not claim search volumes. Show the product motion: listing appears where hunters already look.",
    format: "talking_head",
    objective: "owner_acquisition",
    audience: "property_owner",
    funnel: "CONVERSION",
    searchIntent: "list property Nairobi",
    hook: "POV: The apartment is vacant — and hunters are searching your neighbourhood anyway.",
    keyMessage: "Visibility beats hoping a broker group chat is enough.",
    cta: "List on NyumbaSearch.",
    expectedAction: "Landlord signup / new listing.",
    destination:
      "https://nyumbasearch.com/landlord?utm_source=linkedin&utm_medium=social&utm_campaign=vacant_unit",
    kenyanContext:
      "Vacant months are a real owner pain. No invented ‘2 months vacant’ case studies.",
    requiresVerifiedFacts: false,
    fatigueTags: ["owner", "product"],
  },
  {
    id: "interactive-would-you",
    letter: "F",
    name: "Would you take this rent? (comments engine)",
    mechanism: "Participation + price curiosity. Only with a real listing price.",
    inspirationNotes: [
      "Challenge/comment-bait from lifestyle creators — mechanism is audience vote.",
      "E-commerce: ‘would you buy this’ first-slide carousels.",
    ],
    nyumbaSpin: "Pin comment: ‘Search this area on NyumbaSearch’. Never invent KSh.",
    format: "reel",
    objective: "engagement",
    audience: "house_hunter",
    funnel: "HIGH_INTENT",
    searchIntent: "how much rent costs in Nairobi",
    hook: "Would you pay this rent for this neighbourhood?",
    keyMessage: "Price + area debate drives comments; listing link captures intent.",
    cta: "Comment your budget — then search it on NyumbaSearch.",
    expectedAction: "Comments + listing clicks.",
    destination: "https://nyumbasearch.com/tenant",
    kenyanContext: "Rent debates are native to Kenyan timelines; stay factual to the listing.",
    requiresVerifiedFacts: true,
    fatigueTags: ["interactive", "price"],
  },
  {
    id: "lead-screen-map",
    letter: "G",
    name: "Screen recording: how a Nairobi search actually works",
    mechanism:
      "Product demo as screen + voice — hospitality ‘tour the booking flow’ adapted to map search.",
    inspirationNotes: [
      "Tech/SaaS: 15s product walks outperform brand films for conversion.",
      "Do not claim inventory counts unless pulled live at publish time.",
    ],
    nyumbaSpin: "Show filters (area, beds, map). End on a real area page URL.",
    format: "screen_recording",
    objective: "website_search",
    audience: "house_hunter",
    funnel: "CONSIDERATION",
    searchIntent: "NyumbaSearch app",
    hook: "Stop looking for houses this way. Watch the map instead.",
    keyMessage: "Search is the product. Agents-in-the-middle is the old way.",
    cta: "Open the map on NyumbaSearch.",
    expectedAction: "Map session.",
    destination:
      "https://nyumbasearch.com/tenant/map?utm_source=youtube&utm_medium=social&utm_campaign=map_demo",
    kenyanContext: "‘Skip the agent spam’ is brand, not a legal claim about every agent.",
    requiresVerifiedFacts: false,
    fatigueTags: ["product", "screen"],
  },
  {
    id: "ecosystem-after-keys",
    letter: "H",
    name: "You found the house. Now who is moving you?",
    mechanism:
      "Journey extension — travel ‘what to do after you land’ applied to movers/cleaners/internet.",
    inspirationNotes: [
      "Hospitality + marketplace: after-conversion services.",
      "Keeps the feed from becoming only vacant units.",
    ],
    nyumbaSpin: "Point to /services — no fake provider reviews.",
    format: "carousel",
    objective: "provider_acquisition",
    audience: "mixed",
    funnel: "INTEREST",
    searchIntent: "movers Nairobi",
    hook: "You found the house. The next problem is moving day.",
    keyMessage: "NyumbaSearch is housing journey, not only a listing wall.",
    cta: "Browse home services — or list yours.",
    expectedAction: "Services browse / provider signup.",
    destination:
      "https://nyumbasearch.com/services?utm_source=instagram&utm_medium=social&utm_campaign=after_keys",
    kenyanContext: "Moving day + mama fua + fibre are local follow-on jobs.",
    requiresVerifiedFacts: false,
    fatigueTags: ["services", "ecosystem"],
  },
];
