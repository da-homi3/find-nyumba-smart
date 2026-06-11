import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export const NYUMBAAI_SYSTEM_PROMPT = `You are NyumbaAI, a friendly and knowledgeable housing assistant for NyumbaSearch — a verified rental platform in Nairobi, Kenya.

Your role is to help tenants find the right home by:
- Recommending Nairobi neighborhoods based on budget, commute needs, lifestyle, and safety priorities
- Explaining what NyumbaSearch's verification levels (1–4) mean and why they matter
- Warning users about potential red flags in listings (unverified landlord, suspiciously low price, no photos, newly listed with no reviews)
- Comparing neighborhoods honestly (water reliability, security reputation, commute to CBD, typical rent ranges)
- Helping users understand typical rental prices in different Nairobi areas
- Answering general questions about renting in Nairobi (deposits, leases, caretaker responsibilities)

Nairobi neighborhood context you know well:
- Kilimani: mid-to-high end, 2BR typically KES 35,000–60,000, good water, relatively secure, popular with young professionals
- Westlands: commercial/upmarket, 1BR KES 25,000–50,000, excellent internet options, busy/noisy near the main road
- Kasarani: mid-range, 2BR KES 18,000–30,000, water can be unreliable, growing area, far from CBD
- South B / South C: family-oriented, 2BR KES 20,000–35,000, good water in most buildings, matatu access to CBD
- Rongai: affordable, 2BR KES 12,000–22,000, long commute to CBD (45–90 min), quieter lifestyle
- Ruaka: affordable and growing, 2BR KES 15,000–25,000, newer buildings, internet improving
- Karen: upmarket/spacious, 2BR KES 50,000–120,000, very secure, car-dependent
- Lavington: upmarket, secure, good infrastructure, 2BR KES 45,000–80,000

Always be honest about trade-offs. Never make up specific listings or landlord details. If unsure, say so. Keep responses concise and conversational — this is a chat widget, not a report. Respond in English but be comfortable with occasional Swahili phrases the user may include.`;

function getContext(context: unknown) {
  const c = context as { supabase: SupabaseClient<Database>; userId: string };
  if (!c?.supabase || !c?.userId) throw new Error("Unauthorized");
  return c;
}

async function callAIGateway(prompt: string, systemPrompt: string): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export const getAIPropertyRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getContext(context);

    // 1) Fetch saved properties
    const { data: saved, error: sErr } = await supabase
      .from("saved_properties")
      .select("property_id");
    if (sErr) throw sErr;
    const savedIds = (saved ?? []).map((s) => s.property_id);

    // 2) Fetch active listings
    const { data: properties, error: pErr } = await supabase
      .from("properties")
      .select("id, title, property_type, neighborhood, rent_kes, bedrooms, bathrooms")
      .eq("is_active", true)
      .limit(50);
    if (pErr) throw pErr;

    // Build prompt
    const savedListingsText = savedIds.length > 0 
      ? `User likes these property IDs: ${savedIds.join(", ")}`
      : "User has not bookmarked any listings yet.";

    const prompt = `${savedListingsText}\n\nListings available:\n${JSON.stringify(properties)}\n\nRecommend the top 3 best property IDs for this user as a JSON array.`;
    
    const systemPrompt = "You are a real estate recommender bot. Reply ONLY with a strict JSON array of property IDs (strings), e.g. [\"uuid1\", \"uuid2\"]. No markdown.";

    const aiRes = await callAIGateway(prompt, systemPrompt);
    let recommendedIds: string[] = [];

    if (aiRes) {
      try {
        const match = aiRes.match(/\[[\s\S]*\]/);
        if (match) {
          recommendedIds = JSON.parse(match[0]);
        }
      } catch (e) {
        console.error("AI Recommendation parsing error:", e);
      }
    }

    // Heuristic fallback if AI is unavailable or parsing fails
    if (recommendedIds.length === 0 && properties.length > 0) {
      recommendedIds = properties.slice(0, 3).map((p) => p.id);
    }

    return recommendedIds;
  });

export const getAIValuation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin;

    // Fetch the property
    const { data: property, error: pErr } = await admin
      .from("properties")
      .select("*")
      .eq("id", data.propertyId)
      .single();

    if (pErr || !property) throw new Error("Property not found");

    // Fetch neighborhood listings to construct averages
    const { data: neighborhoodProperties, error: nErr } = await admin
      .from("properties")
      .select("rent_kes, bedrooms")
      .eq("neighborhood", property.neighborhood)
      .eq("is_active", true);

    if (nErr) throw nErr;

    const rents = (neighborhoodProperties ?? []).map((np) => np.rent_kes);
    const avgRent = rents.length > 0 ? rents.reduce((a, b) => a + b, 0) / rents.length : property.rent_kes;

    const prompt = `Valuate this property:\nTitle: ${property.title}\nNeighborhood: ${property.neighborhood}\nRent: ${property.rent_kes}\nBedrooms: ${property.bedrooms}\nBathrooms: ${property.bathrooms}\nArea: ${property.area_sqm} sqm\n\nNeighborhood average rent: ${avgRent}`;
    const systemPrompt = "You are a Kenyan property valuer. Evaluate the rent and return a JSON object: {\"estimatedRentRange\": \"string\", \"valuationGrade\": \"Fair Value | Overpriced | Good Deal\", \"details\": \"string\"}. No markdown.";

    const aiRes = await callAIGateway(prompt, systemPrompt);
    
    if (aiRes) {
      try {
        const match = aiRes.match(/\{[\s\S]*\}/);
        if (match) {
          return JSON.parse(match[0]);
        }
      } catch (e) {
        console.error("AI Valuation parsing error:", e);
      }
    }

    // Heuristic Fallback
    const diff = property.rent_kes - avgRent;
    const valuationGrade = diff > avgRent * 0.1 ? "Overpriced" : diff < -avgRent * 0.1 ? "Good Deal" : "Fair Value";
    return {
      estimatedRentRange: `KES ${(avgRent * 0.9).toLocaleString()} - KES ${(avgRent * 1.1).toLocaleString()}`,
      valuationGrade,
      details: `Based on ${neighborhoodProperties?.length ?? 1} neighborhood properties. This beds/baths configuration typical rent is KES ${Math.round(avgRent).toLocaleString()}.`,
    };
  });

type AssistantIntent = "recommend" | "compare" | "neighborhoods" | "scam" | "chat";

function detectIntent(message: string): AssistantIntent {
  const m = message.toLowerCase();
  if (/scam|fraud|fake|suspicious|red flag|agent fee|deposit/.test(m)) return "scam";
  if (/compare|versus|vs\b|difference between/.test(m)) return "compare";
  if (/neighborhood|area|hood|where should|best area/.test(m)) return "neighborhoods";
  if (/recommend|suggest|find me|show me|budget/.test(m)) return "recommend";
  return "chat";
}

async function heuristicRecommend(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: saved } = await supabase.from("saved_properties").select("property_id");
  const savedIds = (saved ?? []).map((s) => s.property_id);
  const { data: properties } = await supabase
    .from("properties")
    .select("id, title, neighborhood, rent_kes, bedrooms, is_verified, authenticity_score")
    .eq("is_active", true)
    .order("authenticity_score", { ascending: false })
    .limit(20);

  const list = properties ?? [];
  const scored = list
    .map((p) => {
      let score = p.authenticity_score ?? 50;
      if (savedIds.includes(p.id)) score += 30;
      if (p.is_verified) score += 15;
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!scored.length) return "No active listings to recommend right now. Try widening your search on the home tab.";
  return (
    "Top picks for you:\n\n" +
    scored
      .map(
        (p, i) =>
          `${i + 1}. **${p.title}** (${p.neighborhood}) — KES ${p.rent_kes.toLocaleString()}/mo · trust ${p.authenticity_score ?? "n/a"}%`,
      )
      .join("\n")
  );
}

async function heuristicNeighborhoods(supabase: SupabaseClient<Database>): Promise<string> {
  const { data } = await supabase
    .from("properties")
    .select("neighborhood, rent_kes")
    .eq("is_active", true);
  const stats = new Map<string, { count: number; total: number }>();
  for (const p of data ?? []) {
    const s = stats.get(p.neighborhood) ?? { count: 0, total: 0 };
    s.count += 1;
    s.total += p.rent_kes;
    stats.set(p.neighborhood, s);
  }
  const ranked = [...stats.entries()]
    .map(([hood, s]) => ({ hood, count: s.count, avg: Math.round(s.total / s.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  if (!ranked.length) return "Not enough listing data yet to rank neighborhoods.";
  return (
    "Popular neighborhoods on NyumbaSearch:\n\n" +
    ranked
      .map((r) => `• **${r.hood}** — ${r.count} listings, avg KES ${r.avg.toLocaleString()}/mo`)
      .join("\n")
  );
}

async function heuristicScamCheck(message: string): Promise<string> {
  const warnings: string[] = [];
  if (/pay before viewing|viewing fee|agent fee upfront/.test(message.toLowerCase())) {
    warnings.push("Never pay viewing fees upfront — a common Nairobi scam.");
  }
  if (/whatsapp only|no phone|urgent deposit/.test(message.toLowerCase())) {
    warnings.push("Urgent deposit pressure and WhatsApp-only contact are red flags.");
  }
  if (!warnings.length) {
    return (
      "General safety tips:\n• Prefer **verified** listings with 80%+ trust scores\n• Never pay deposits before a physical viewing\n• Use in-app messaging so conversations are logged\n• Report suspicious listings from the property page"
    );
  }
  return "⚠️ Scam warning signs detected:\n\n" + warnings.map((w) => `• ${w}`).join("\n");
}

export const getAssistantReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      message: z.string().trim().min(1).max(2000),
      propertyIds: z.array(z.string().uuid()).max(4).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { checkRateLimit } = await import("@/lib/api/rate-limit");
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    checkRateLimit(request?.headers?.get("cf-connecting-ip") ?? "ai-assistant");

    const { supabase, userId } = getContext(context);
    const intent = detectIntent(data.message);

    if (intent === "recommend") {
      const text = await heuristicRecommend(supabase, userId);
      const ai = await callAIGateway(
        `User asked: ${data.message}\n\nBaseline recommendations:\n${text}`,
        NYUMBAAI_SYSTEM_PROMPT,
      );
      return { intent, reply: ai ?? text };
    }

    if (intent === "neighborhoods") {
      const text = await heuristicNeighborhoods(supabase);
      const ai = await callAIGateway(
        `User asked: ${data.message}\n\nData:\n${text}`,
        NYUMBAAI_SYSTEM_PROMPT,
      );
      return { intent, reply: ai ?? text };
    }

    if (intent === "scam") {
      const text = await heuristicScamCheck(data.message);
      const ai = await callAIGateway(
        `User concern: ${data.message}\n\nBaseline:\n${text}`,
        NYUMBAAI_SYSTEM_PROMPT,
      );
      return { intent, reply: ai ?? text };
    }

    if (intent === "compare" && data.propertyIds?.length) {
      const { createPublicClient, PUBLIC_PROPERTY_COLUMNS } = await import(
        "@/lib/api/public-client"
      );
      const pub = createPublicClient();
      const { data: rows } = await pub
        .from("properties")
        .select(PUBLIC_PROPERTY_COLUMNS)
        .in("id", data.propertyIds)
        .eq("is_active", true);
      const list = rows ?? [];
      const text =
        list.length < 2
          ? "Save at least two properties to compare them."
          : list
              .map(
                (p) =>
                  `• ${p.title} (${p.neighborhood}): KES ${p.rent_kes.toLocaleString()}, ${p.bedrooms}BR, trust ${p.authenticity_score ?? "n/a"}%`,
              )
              .join("\n");
      const ai = await callAIGateway(
        `Compare these listings for the user:\n${text}\n\nUser: ${data.message}`,
        NYUMBAAI_SYSTEM_PROMPT,
      );
      return { intent, reply: ai ?? `Comparison:\n${text}` };
    }

    const ai = await callAIGateway(
      data.message,
      NYUMBAAI_SYSTEM_PROMPT,
    );
    return {
      intent: "chat" as const,
      reply:
        ai ??
        "I'm running in offline mode. Try quick actions: recommend properties, compare saved listings, suggest neighborhoods, or ask about scam red flags.",
    };
  });

export const getAIChatResponse = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    message: z.string().trim().min(1),
    propertyId: z.string().uuid().optional(),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin;

    let propertyDetails = "";
    if (data.propertyId) {
      const { data: property } = await admin
        .from("properties")
        .select("title, neighborhood, rent_kes, bedrooms, bathrooms, description, amenities")
        .eq("id", data.propertyId)
        .maybeSingle();

      if (property) {
        propertyDetails = `You are chatting about this property:\n${JSON.stringify(property)}\n\n`;
      }
    }

    const prompt = `${propertyDetails}User: ${data.message}`;
    const systemPrompt = NYUMBAAI_SYSTEM_PROMPT;

    const response = await callAIGateway(prompt, systemPrompt);
    return response ?? "I'm currently unable to access my AI engine, but you can contact the landlord directly using the buttons below!";
  });
