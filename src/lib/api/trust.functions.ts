import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";

const submitVerificationSchema = z.object({
  verificationType: z.enum(["phone", "identity", "business", "ownership"]),
  documents: z.array(z.string().url()).default([]),
  notes: z.string().trim().max(1000).optional(),
});

const reportScamSchema = z.object({
  propertyId: z.string().uuid(),
  reason: z.string().trim().min(3).max(100),
  details: z.string().trim().max(1000).optional(),
});

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const submitVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(submitVerificationSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);

    const { data: row, error } = await supabase
      .from("verifications")
      .insert({
        user_id: userId,
        verification_type: data.verificationType,
        documents: data.documents,
        notes: data.notes ?? null,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) throw error;
    return row;
  });

export const reportScam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(reportScamSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);

    // Auto-moderation check: flag if keywords include typical rental scams
    const lowercaseDetails = (data.details ?? "").toLowerCase();
    const isAutoFlagged =
      lowercaseDetails.includes("viewing fee") ||
      lowercaseDetails.includes("pay before") ||
      lowercaseDetails.includes("booking fee") ||
      data.reason.toLowerCase().includes("viewing fee");

    const status = isAutoFlagged ? "reviewed" : "pending";

    const { data: row, error } = await supabase
      .from("scam_reports")
      .insert({
        property_id: data.propertyId,
        reporter_id: userId,
        reason: data.reason,
        details: data.details ?? null,
        status,
      })
      .select("*")
      .single();

    if (error) throw error;

    // Record fraud signal for auto-flagged reports
    if (isAutoFlagged) {
      const admin = await adminClient();
      await admin.from("fraud_signals").insert({
        property_id: data.propertyId,
        user_id: userId,
        signal_type: "viewing_fee_scam",
        severity: "high",
        details: { reason: data.reason, autoFlagged: true },
      });
    }

    // If auto-flagged, set property is_active to false until landlord reviews
    if (isAutoFlagged) {
      const admin = await adminClient();
      await admin.from("properties").update({ is_active: false }).eq("id", data.propertyId);
    }

    return { report: row, autoFlagged: isAutoFlagged };
  });

export const checkListingDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase } = getAuthContext(context);

    // Fetch property details
    const { data: property, error: pErr } = await supabase
      .from("properties")
      .select("id, images, title, neighborhood")
      .eq("id", data.propertyId)
      .single();

    if (pErr || !property) throw new Error("Property not found");
    if (!property.images || property.images.length === 0) return { duplicateDetected: false };

    // Simple perceptual duplicate detection: match properties with identical primary image URL or very similar title in the same neighborhood
    const primaryImg = property.images[0];
    const { data: duplicates, error: dErr } = await supabase
      .from("properties")
      .select("id, title, owner_id")
      .neq("id", property.id)
      .eq("neighborhood", property.neighborhood)
      .eq("is_active", true)
      .or(`images.cs.{${primaryImg}},title.ilike.%${property.title}%`);

    if (dErr) throw dErr;
    return {
      duplicateDetected: duplicates.length > 0,
      duplicates: duplicates,
    };
  });
