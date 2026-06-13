import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { callGeminiChat } from "@/lib/api/ai-client";
import { getAuthContext, JSON_OBJECT_RE } from "@/lib/api/server-context";
import {
  adminClient,
  assertCanManageProperty,
} from "@/lib/api/nyumba/nyumba-shared";

const QUALITY_AI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";

const propertyIdSchema = z.object({ propertyId: z.string().uuid() });

type QualityResult = {
  score: number;
  grade: string;
  summary: string;
  strengths: string[];
  improvements: string[];
};

function scoreGrade(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function formatMediaSummary(images: number, hasVideo: boolean, hasTour: boolean): string {
  const videoLabel = hasVideo ? "video" : "no video";
  const tourLabel = hasTour ? "360 tour" : "no tour";
  return `Baseline listing analysis — ${images} photos, ${videoLabel}, ${tourLabel}.`;
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
  const grade = scoreGrade(score);
  return {
    score,
    grade,
    summary: formatMediaSummary(images, hasVideo, hasTour),
    strengths,
    improvements,
  };
}

async function callAI(prompt: string): Promise<QualityResult | null> {
  try {
    const systemPrompt =
      'You are an expert real-estate listing reviewer for Nairobi rentals. Reply ONLY with strict JSON: {"score":0-100,"grade":"A|B|C|D|F","summary":string,"strengths":string[],"improvements":string[]}. No markdown.';
    const text = await callGeminiChat(systemPrompt, prompt);
    if (!text) return null;
    const jsonText = JSON_OBJECT_RE.exec(text)?.[0];
    if (!jsonText) return null;
    const parsed = JSON.parse(jsonText) as Partial<QualityResult>;
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
  } catch (err) {
    console.warn("[media] AI quality parse failed:", err);
    return null;
  }
}

async function runQualityAnalysis(supabase: SupabaseClient, userId: string, propertyId: string) {
  await assertCanManageProperty(supabase, userId, propertyId);
  const admin = await adminClient();
  const { data: property, error } = await admin
    .from("properties")
    .select("*")
    .eq("id", propertyId)
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
      model: ai ? QUALITY_AI_MODEL : "heuristic",
    })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return inserted;
}

export const analyzePropertyQuality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(propertyIdSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    return runQualityAnalysis(supabase, userId, data.propertyId);
  });

export const listPropertyQualityReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(propertyIdSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await assertCanManageProperty(supabase, userId, data.propertyId);
    const { data: rows, error } = await supabase
      .from("property_quality_reports")
      .select("*")
      .eq("property_id", data.propertyId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    return rows ?? [];
  });

const signSchema = z.object({
  paths: z.array(z.string().min(1).max(512)).min(1).max(20),
  expiresIn: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24 * 365)
    .optional(),
});

export const createSignedMediaUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(signSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
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

const updateMediaSchema = z.object({
  propertyId: z.string().uuid(),
  images: z.array(z.string().url()).optional(),
  video_url: z.string().url().nullable().optional(),
  tour_url: z.string().url().nullable().optional(),
  appendImages: z.array(z.string().url()).optional(),
  removeImages: z.array(z.string().url()).optional(),
  runQualityAnalysis: z.boolean().default(true),
});

export const updatePropertyMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(updateMediaSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    const existing = await assertCanManageProperty(supabase, userId, data.propertyId);

    let images = data.images ?? [...(existing.images ?? [])];
    if (data.appendImages?.length) images = [...images, ...data.appendImages];
    if (data.removeImages?.length) {
      const remove = new Set(data.removeImages);
      images = images.filter((u) => !remove.has(u));
    }

    const admin = await adminClient();
    const patch: Record<string, unknown> = {
      images,
      updated_at: new Date().toISOString(),
    };
    if (data.video_url !== undefined) patch.video_url = data.video_url;
    if (data.tour_url !== undefined) patch.tour_url = data.tour_url;

    const { data: property, error } = await admin
      .from("properties")
      .update(patch)
      .eq("id", data.propertyId)
      .select("*")
      .single();
    if (error) throw error;

    let qualityReport = null;
    if (data.runQualityAnalysis) {
      try {
        qualityReport = await runQualityAnalysis(supabase, userId, data.propertyId);
      } catch (err) {
        console.warn("[media] Post-upload quality analysis failed:", err);
        qualityReport = null;
      }
    }
    return { property, qualityReport };
  });
