import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

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
    const systemPrompt = "You are NyumbaSearch's AI Assistant. Help the user answer questions about rentals in Nairobi, security, water, or the specific listing detail provided. Keep responses helpful, concise, and professional.";

    const response = await callAIGateway(prompt, systemPrompt);
    return response ?? "I'm currently unable to access my AI engine, but you can contact the landlord directly using the buttons below!";
  });
