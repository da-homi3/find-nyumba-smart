import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const propertyIdSchema = z.object({ propertyId: z.string().uuid() });

type QualityResult = {
  score: number;
  grade: string;
  summary: string;
  strengths: string[];
  improvements: string[];
};

function ctx(context: unknown) {
  const c = context as { supabase: any; userId: string };
  if (!c?.supabase || !c?.userId) throw new Error("Unauthorized");
  return c;
}

function fallbackScore(p: {
  title?: string | null;
  description?: string | null;
  images?: string[] | null;
  video_url?: string | null;
  tour_url?: string | null;
  amenities?: string[] | null;
}): QualityResult {
  const images = p.images?.length ?? 0;
  const hasVideo = !!p.video_url;
  const hasTour = !!p.tour_url;
  const descLen = (p.description ?? "").length;
  const amenities = p.amenities?.length ?? 0;
  let score = 0;
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (images >= 5) {
    score += 35;
    strengths.push(`${images} photos uploaded`);
  } else if (images >= 1) {
    score += 15;
    improvements.push("Upload at least 5 photos covering every room");
  } else improvements.push("Add property photos — listings without photos rarely convert");

  if (hasVideo) {
    score += 15;
    strengths.push("Walkthrough video available");
  } else improvements.push("Add a short walkthrough video");

  if (hasTour) {
    score += 15;
    strengths.push("360° virtual tour available");
  } else improvements.push("Add a 360° virtual tour for premium positioning");

  if (descLen > 200) {
    score += 20;
    strengths.push("Detailed description");
  } else improvements.push("Expand the description with neighborhood and lifestyle details");

  if (amenities >= 4) {
    score += 15;
    strengths.push(`${amenities} amenities listed`);
  } else improvements.push("List more amenities (WiFi, parking, security, water, etc.)");

  score = Math.min(100, score);
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
  return {
    score,
    grade,
    summary: `Baseline listing analysis — ${images} photos, ${hasVideo ? "video" : "no video"}, ${hasTour ? "360 tour" : "no tour"}.`,
    strengths,
    improvements,
  };
}

async function callAI(prompt: string): Promise<QualityResult | null> {
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
          {
            role: "system",
            content:
              "You are an expert real-estate listing reviewer for Nairobi rentals. Reply ONLY with strict JSON: {\"score\":0-100,\"grade\":\"A|B|C|D|F\",\"summary\":string,\"strengths\":string[],\"improvements\":string[]}. No markdown.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<QualityResult>;
    if (typeof parsed.score !== "number") return null;
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      grade: String(parsed.grade ?? "C").slice(0, 2),
      summary: String(parsed.summary ?? ""),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 8).map(String) : [],
      improvements: Array.isArray(parsed.improvements)
        ? parsed.improvements.slice(0, 8).map(String)
        : [],
    };
  } catch {
    return null;
  }
}

export const analyzePropertyQuality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(propertyIdSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = ctx(context);
    const { data: property, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", data.propertyId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!property) throw new Error("Property not found");

    const prompt = `Analyze this rental listing for completeness, attractiveness, and conversion potential.

Title: ${property.title}
Type: ${property.property_type}
Neighborhood: ${property.neighborhood}
Rent (KES/mo): ${property.rent_kes}
Bedrooms: ${property.bedrooms} | Bathrooms: ${property.bathrooms}
Area: ${property.area_sqm ?? "n/a"} sqm
Amenities: ${(property.amenities ?? []).join(", ") || "none"}
Photos: ${property.images?.length ?? 0}
Video: ${property.video_url ? "yes" : "no"}
360 Tour: ${property.tour_url ? "yes" : "no"}
Description: ${property.description ?? "(empty)"}

Score 0-100. Be concrete and actionable.`;

    const ai = await callAI(prompt);
    const result = ai ?? fallbackScore(property);
    const mediaCount =
      (property.images?.length ?? 0) + (property.video_url ? 1 : 0) + (property.tour_url ? 1 : 0);

    const { data: inserted, error: insErr } = await supabase
      .from("property_quality_reports")
      .insert({
        property_id: property.id,
        owner_id: userId,
        score: result.score,
        grade: result.grade,
        summary: result.summary,
        strengths: result.strengths,
        improvements: result.improvements,
        media_count: mediaCount,
        model: ai ? MODEL : "heuristic",
      })
      .select("*")
      .single();
    if (insErr) throw insErr;
    return inserted;
  });

export const listPropertyQualityReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(propertyIdSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = ctx(context);
    const { data: rows, error } = await supabase
      .from("property_quality_reports")
      .select("*")
      .eq("property_id", data.propertyId)
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    return rows ?? [];
  });

const signSchema = z.object({
  paths: z.array(z.string().min(1).max(512)).min(1).max(20),
  expiresIn: z.number().int().positive().max(60 * 60 * 24 * 365).optional(),
});

export const createSignedMediaUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(signSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = ctx(context);
    // ensure paths belong to the user
    for (const p of data.paths) {
      if (!p.startsWith(`${userId}/`)) throw new Error("Forbidden path");
    }
    const { data: signed, error } = await supabase.storage
      .from("property-media")
      .createSignedUrls(data.paths, data.expiresIn ?? 60 * 60 * 24 * 365);
    if (error) throw error;
    return signed;
  });
