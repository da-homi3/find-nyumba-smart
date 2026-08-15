import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import {
  getListingUnlockStateCore,
  unlockListingContactCore,
} from "@/lib/payments/contact-unlock-core";

export const getListingUnlockState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return getListingUnlockStateCore(supabaseAdmin, userId, data.listingId);
  });

export const unlockListingContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      listingId: z.string().uuid(),
      method: z.enum(["mpesa", "card"]).optional(),
      phoneNumber: z.string().optional(),
      email: z.string().email().optional(),
      idempotencyKey: z.string().min(8).max(64).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return unlockListingContactCore(supabaseAdmin, userId, data);
  });

export const listMyContactUnlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("contact_unlocks")
      .select("id, listing_id, method, fee_charged, unlocked_at")
      .eq("user_id", userId)
      .order("unlocked_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const listingIds = [...new Set((data ?? []).map((row) => row.listing_id))];
    const titles = new Map<string, string>();
    if (listingIds.length) {
      const { data: listings } = await supabaseAdmin
        .from("properties")
        .select("id, title")
        .in("id", listingIds);
      for (const listing of listings ?? []) titles.set(listing.id, listing.title);
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      title: titles.get(row.listing_id) ?? "Listing",
      method: row.method,
      feeCharged: row.fee_charged,
      unlockedAt: row.unlocked_at,
    }));
  });

const CONTACT_ISSUE_REASONS = [
  "number_doesnt_work",
  "property_doesnt_exist",
  "already_rented",
  "wrong_contact",
  "suspicious",
  "duplicate",
  "other",
] as const;

export const reportContactIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      listingId: z.string().uuid(),
      reason: z.enum(CONTACT_ISSUE_REASONS),
      details: z.string().trim().max(1000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const { data: unlock } = await supabaseAdmin
      .from("contact_unlocks")
      .select("id")
      .eq("user_id", userId)
      .eq("listing_id", data.listingId)
      .maybeSingle();
    if (!unlock) throw new Error("Unlock this contact before reporting an issue.");
    const { error } = await asLooseDb(supabaseAdmin).from("contact_issues").insert({
      user_id: userId,
      listing_id: data.listingId,
      reason: data.reason,
      details: data.details ?? null,
      status: "pending",
    });
    if (error) throw error;
    const { recordProductEventCore } = await import("@/lib/analytics/product-events");
    void recordProductEventCore(userId, "contact_reported", { listingId: data.listingId, reason: data.reason });
    return {
      reported: true,
      message:
        "Thanks. Our team will review this report. Refunds follow NyumbaSearch's refund policy and are not automatic.",
    };
  });
