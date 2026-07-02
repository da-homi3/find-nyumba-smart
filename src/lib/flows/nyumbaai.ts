import { callGeminiChat } from "@/lib/api/ai-client";
import { buildNyumbaAiProfileContext, type UserAssistantProfile } from "@/lib/whatsapp/user-profile";

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

export async function enhanceListingDescription(rawDesc: string, draft: Record<string, unknown>): Promise<string> {
  const system =
    "Clean and improve Nairobi rental property descriptions. Fix grammar, improve clarity, keep honest. Return only the improved description.";
  const propertyType = draftField(draft.property_type);
  const neighborhood = draftField(draft.neighborhood);
  const price = draftField(draft.price);
  const bedroomLabel = formatBedroomLabel(draft.bedrooms);
  const user = `Property: ${propertyType}, ${bedroomLabel}, ${neighborhood}, KES ${price}/mo\n\nRaw: ${rawDesc}`;
  const reply = await callGeminiChat(system, user);
  return reply ?? rawDesc;
}
