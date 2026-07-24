import { callGeminiChat, callGeminiMultimodal, type GeminiInlineImage } from "@/lib/api/ai-client";
import {
  buildNyumbaAiProfileContext,
  type UserAssistantProfile,
} from "@/lib/whatsapp/user-profile";
import {
  clampAmenities,
  extractAmenitiesHeuristic,
  formatAmenityString,
  mergeAmenities,
  parseAmenityString,
} from "@/lib/listings/amenities";
import { firstRegexMatch, JSON_ARRAY_RE } from "@/lib/api/server-context";

const NYUMBAAI_BASE = `You are NyumbaAI, the personal property assistant for NyumbaSearch — Kenya's verified home search platform at nyumbasearch.com.

You answer questions about:
- Nairobi neighbourhoods (safety, amenities, commute, price ranges, water supply, internet availability)
- Property prices and what's reasonable to pay in each area
- Red flags that indicate a scam listing
- What to check when viewing a rental property in Nairobi
- Kenyan tenancy law (basic tenant rights, notice periods, deposit rules)
- Areas and property types that suit different budgets

Rules:
- Always respond in the same language the user writes in (English or Swahili)
- Be concise — WhatsApp messages should be under 300 words
- Use emojis sparingly (1-2 per message maximum)
- Never make up specific prices — give ranges and note they change frequently
- If asked about a specific listing, direct the user to search on nyumbasearch.com
- If asked about illegal activity, decline politely
- Always be helpful and honest — if you don't know, say so
- When user profile context is provided, personalize answers and reference their saved homes, viewings, plan, or listings when relevant`;

function draftField(value: unknown, fallback = ""): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return fallback;
}

function formatBedroomLabel(bedrooms: unknown): string {
  const count = typeof bedrooms === "number" ? bedrooms : Number(bedrooms);
  if (Number.isNaN(count)) return "bedroom count unknown";
  if (count === 0) return "bedsitter";
  return `${count}BR`;
}

function formatConversationPrompt(
  history: { role: string; content: string }[],
  userMessage: string,
): string {
  if (history.length === 0) return userMessage;
  const conversation = history.map((m) => `${m.role}: ${m.content}`).join("\n");
  return `${conversation}\nuser: ${userMessage}`;
}

export async function callNyumbaAI(
  userMessage: string,
  history: { role: string; content: string }[],
  profile?: UserAssistantProfile | null,
): Promise<string> {
  const systemPrompt = `${NYUMBAAI_BASE}\n\n--- User profile ---\n${buildNyumbaAiProfileContext(profile ?? null)}`;

  const recent = history.slice(-10);
  const prompt = formatConversationPrompt(recent, userMessage);

  const reply = await callGeminiChat(systemPrompt, prompt);
  return reply ?? "I'm having trouble connecting right now. Please try again in a moment.";
}

export type ListingCopyDraft = {
  title?: unknown;
  property_type?: unknown;
  bedrooms?: unknown;
  bathrooms?: unknown;
  neighborhood?: unknown;
  lat?: unknown;
  lng?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  price?: unknown;
  rent_kes?: unknown;
  amenities?: unknown;
  description?: unknown;
};

function buildListingContextBlock(draft: ListingCopyDraft, rawDesc: string): string {
  const propertyType = draftField(draft.property_type);
  const neighborhood = draftField(draft.neighborhood);
  const price = draftField(draft.price ?? draft.rent_kes);
  const bedroomLabel = formatBedroomLabel(draft.bedrooms);
  const baths = draftField(draft.bathrooms);
  const title = draftField(draft.title);
  const lat = draftField(draft.lat ?? draft.latitude);
  const lng = draftField(draft.lng ?? draft.longitude);
  const amenities = formatAmenityString(
    Array.isArray(draft.amenities)
      ? (draft.amenities as string[])
      : draftField(draft.amenities),
  );
  const bathsLabel = baths ? `${baths} bath(s)` : "baths n/a";
  const propertyLine = `Property: ${propertyType || "unknown"}, ${bedroomLabel}, ${bathsLabel}`;
  const coords =
    lat && lng ? `Coordinates: ${lat}, ${lng}` : "Coordinates: not set";

  return [
    title ? `Title: ${title}` : null,
    propertyLine,
    `Neighborhood: ${neighborhood || "Nairobi"}`,
    price ? `Rent: KES ${price}/mo` : null,
    amenities ? `Amenities: ${amenities}` : null,
    coords,
    "",
    `Raw description:\n${rawDesc}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

const ENHANCE_SYSTEM = `You are a senior Kenya rental copywriter for NyumbaSearch. Edit EVERY listing description into neat, proper, professional tenant-facing copy that attracts serious renters — without inventing facts.

Always do this:
- ALWAYS rewrite — never return the original text unchanged, even if it already looks decent
- Fix spelling, grammar, capitalization, and punctuation
- Clean messy notes, chatty fragments, and run-on sentences into clear prose
- Rephrase for stronger flow, rhythm, and tenant appeal while keeping the same facts
- Organize into 2–4 short, tidy paragraphs with a natural flow
- Lead with the strongest genuine selling points (location, space, finishes, amenities)
- Use warm, confident language a Nairobi tenant would trust — not hype, slang spam, or clickbait
- Make the home easy to picture (comfort, lifestyle, practical benefits)

Hard rules:
- Keep every fact honest: do NOT invent amenities, finishes, views, schools, malls, or landmarks not supported by the draft, amenities list, or photos
- Prefer English unless the raw description is clearly in Swahili — then write in Swahili
- No markdown headings; no bullet lists unless the original used them
- Mention water, security, parking, or internet only if present in the draft/amenities/photos
- End with a soft call to action when it fits (e.g. invite viewing) — never guarantee availability or prices not given
- Return ONLY the improved description text — it must differ from the raw description`;

function normalizeDesc(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

const LISTING_AI_OPTS = { priority: "latency" as const };

export async function enhanceListingDescription(
  rawDesc: string,
  draft: ListingCopyDraft,
): Promise<string> {
  const user = `${buildListingContextBlock(draft, rawDesc)}\n\nRewrite this into a neat, proper, professional rental listing description that attracts customers. You must change the wording — do not copy the raw description verbatim.`;
  const reply = await callGeminiChat(ENHANCE_SYSTEM, user, LISTING_AI_OPTS);
  const first = reply?.trim() || "";
  if (!first) {
    throw new Error("AI enhance is temporarily unavailable. Try again in a moment.");
  }
  return first;
}

export async function enhanceListingCopyWithImages(
  rawDesc: string,
  draft: ListingCopyDraft,
  images: GeminiInlineImage[] = [],
): Promise<string> {
  const user = `${buildListingContextBlock(draft, rawDesc)}\n\nRewrite this into a neat, proper, professional rental listing description that attracts customers. You must change the wording — do not copy the raw description verbatim. Use the attached photos only to describe visible finishes honestly. Do not invent rooms or amenities you cannot see.`;
  if (images.length > 0) {
    const reply = await callGeminiMultimodal(ENHANCE_SYSTEM, user, images, LISTING_AI_OPTS);
    const first = reply?.trim() || "";
    if (first && normalizeDesc(first) !== normalizeDesc(rawDesc)) return first;
  }
  return enhanceListingDescription(rawDesc, draft);
}

/**
 * Polish description + extract amenities in parallel (max 2 AI calls).
 * Avoids the old sequential analyze→enhance→extract cascade that spun the UI forever.
 */
export async function polishListingDescriptionAndAmenities(
  rawDesc: string,
  draft: ListingCopyDraft,
  images: GeminiInlineImage[] = [],
  existingAmenities?: string[] | string | null,
): Promise<{ description: string; amenities: string[] }> {
  const existing = Array.isArray(existingAmenities)
    ? existingAmenities
    : parseAmenityString(existingAmenities ?? "");

  const [description, fromAi] = await Promise.all([
    enhanceListingCopyWithImages(rawDesc, draft, images),
    extractAmenitiesFromText(rawDesc, existing),
  ]);

  const amenities = clampAmenities(
    mergeAmenities(
      existing,
      extractAmenitiesHeuristic(rawDesc),
      extractAmenitiesHeuristic(description),
      fromAi,
    ),
  );

  return { description, amenities };
}

function parseAmenityJsonArray(aiRes: string | null): string[] {
  if (!aiRes) return [];
  try {
    const jsonText = firstRegexMatch(aiRes, JSON_ARRAY_RE);
    if (!jsonText) return [];
    const parsed = JSON.parse(jsonText) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Extract amenities via Gemini + keyword heuristics; merge with any existing list. */
export async function extractAmenitiesFromText(
  description: string,
  existingAmenities?: string[] | string | null,
): Promise<string[]> {
  const heuristic = extractAmenitiesHeuristic(description);
  const existing = Array.isArray(existingAmenities)
    ? existingAmenities
    : parseAmenityString(existingAmenities ?? "");

  const system = `You are a meticulous Kenya rental amenity extractor for NyumbaSearch.
Do a thorough line-by-line pass of the description.
Reply ONLY with a JSON string array of short amenity labels.
Extract EVERY amenity, feature, appliance, utility, security item, finish, and facility explicitly mentioned or clearly implied.
Use common Kenya rental terms (WiFi, Borehole, Parking, En-suite, Balcony, CCTV, Generator, DSQ, Fibre, Lift, etc.).
Do not invent amenities not supported by the text.
Prefer completeness over brevity — list all distinct amenities, not a short sample.`;

  const user = `Description:\n${description}\n\nKnown amenities already selected: ${formatAmenityString(existing) || "(none)"}\n\nReturn a JSON array with every amenity found.`;

  const aiRes = await callGeminiChat(system, user, LISTING_AI_OPTS);
  const fromAi = parseAmenityJsonArray(aiRes);

  return clampAmenities(mergeAmenities(existing, heuristic, fromAi));
}
