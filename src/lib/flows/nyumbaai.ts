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

const ENHANCE_SYSTEM = `You write professional Nairobi/Kenya rental listing descriptions for NyumbaSearch.
Rules:
- Improve grammar, clarity, and structure; keep the landlord's facts honest
- Do NOT invent amenities, finishes, views, or nearby landmarks not supported by the draft or photos
- Prefer English unless the raw description is clearly in Swahili — then write in Swahili
- 2–4 short paragraphs max; no markdown headings; no bullet lists unless the original used them
- Mention water, security, parking, or internet only if present in the draft/amenities/photos
- Return ONLY the improved description text`;

export async function enhanceListingDescription(
  rawDesc: string,
  draft: ListingCopyDraft,
): Promise<string> {
  const user = buildListingContextBlock(draft, rawDesc);
  const reply = await callGeminiChat(ENHANCE_SYSTEM, user);
  return reply?.trim() || rawDesc;
}

export async function enhanceListingCopyWithImages(
  rawDesc: string,
  draft: ListingCopyDraft,
  images: GeminiInlineImage[] = [],
): Promise<string> {
  const user = `${buildListingContextBlock(draft, rawDesc)}\n\nUse the attached photos only to describe visible finishes honestly. Do not invent rooms or amenities you cannot see.`;
  if (images.length > 0) {
    const reply = await callGeminiMultimodal(ENHANCE_SYSTEM, user, images);
    if (reply?.trim()) return reply.trim();
  }
  return enhanceListingDescription(rawDesc, draft);
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

  const system =
    'Extract rental amenities mentioned in a Kenyan property description. Reply ONLY with a JSON string array of short amenity labels (e.g. ["WiFi","Borehole","Parking"]). Use common Kenya rental terms. Do not invent amenities not implied by the text. Max 15 items.';
  const user = `Description:\n${description}\n\nKnown amenities already selected: ${formatAmenityString(existing) || "(none)"}`;

  const aiRes = await callGeminiChat(system, user);
  const fromAi = parseAmenityJsonArray(aiRes);

  return clampAmenities(mergeAmenities(existing, heuristic, fromAi));
}
