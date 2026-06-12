import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getAuthContext } from "@/lib/api/server-context";

const SESSION_DAYS = 7;

async function hashValue(value: string): Promise<string> {
  const secret = process.env.CARETAKER_SESSION_SECRET ?? "nyumba-caretaker-dev-secret";
  const data = new TextEncoder().encode(`${secret}:${value}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function resolveCaretakerFromToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = await hashValue(token);
  const { data: session } = await supabaseAdmin
    .from("caretaker_sessions")
    .select("caretaker_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!session) throw new Error("Invalid caretaker session");
  if (new Date(session.expires_at) < new Date()) {
    throw new Error("Caretaker session expired");
  }
  const { data: caretaker } = await supabaseAdmin
    .from("caretakers")
    .select("*")
    .eq("id", session.caretaker_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!caretaker) throw new Error("Caretaker not found");
  return caretaker;
}

export const listCaretakers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "landlord");
    const { data: caretakers, error } = await supabase
      .from("caretakers")
      .select("id, full_name, phone, is_active, created_at, last_login_at")
      .eq("landlord_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!caretakers?.length) return [];

    const ids = caretakers.map((c) => c.id);
    const { data: assignments } = await supabase
      .from("caretaker_property_assignments")
      .select("caretaker_id, property_id")
      .in("caretaker_id", ids);

    const byCaretaker = new Map<string, { property_id: string }[]>();
    for (const row of assignments ?? []) {
      const list = byCaretaker.get(row.caretaker_id) ?? [];
      list.push({ property_id: row.property_id });
      byCaretaker.set(row.caretaker_id, list);
    }

    return caretakers.map((c) => ({
      ...c,
      caretaker_property_assignments: byCaretaker.get(c.id) ?? [],
    }));
  });

export const createCaretaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      fullName: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(9).max(20),
      propertyIds: z.array(z.string().uuid()).min(1).max(50),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "landlord");

    const { data: owned } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", userId)
      .in("id", data.propertyIds);
    if ((owned ?? []).length !== data.propertyIds.length) {
      throw new Error("One or more properties are not yours");
    }

    const pin = generatePin();
    const pinHash = await hashValue(pin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("caretakers")
      .insert({
        landlord_id: userId,
        full_name: data.fullName,
        phone: data.phone,
        pin_hash: pinHash,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw error;

    await supabaseAdmin.from("caretaker_property_assignments").insert(
      data.propertyIds.map((propertyId) => ({
        caretaker_id: row.id,
        property_id: propertyId,
      })),
    );

    return { caretakerId: row.id, pin };
  });

export const regenerateCaretakerPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ caretakerId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "landlord");
    const pin = generatePin();
    const pinHash = await hashValue(pin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("caretakers")
      .update({ pin_hash: pinHash })
      .eq("id", data.caretakerId)
      .eq("landlord_id", userId);
    if (error) throw error;
    return { pin };
  });

export const revokeCaretaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ caretakerId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "landlord");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("caretakers")
      .update({ is_active: false })
      .eq("id", data.caretakerId)
      .eq("landlord_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const verifyCaretakerLogin = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      phone: z.string().trim().min(9).max(20),
      pin: z.string().length(4),
    }),
  )
  .handler(async ({ data }) => {
    checkRateLimit(`caretaker-pin:${data.phone}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pinHash = await hashValue(data.pin);
    const { data: caretaker } = await supabaseAdmin
      .from("caretakers")
      .select("id, full_name, phone")
      .eq("phone", data.phone)
      .eq("pin_hash", pinHash)
      .eq("is_active", true)
      .maybeSingle();
    if (!caretaker) throw new Error("Invalid phone or PIN");

    const token = generateToken();
    const tokenHash = await hashValue(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

    await supabaseAdmin.from("caretaker_sessions").insert({
      caretaker_id: caretaker.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });
    await supabaseAdmin
      .from("caretakers")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", caretaker.id);

    return { token, caretakerName: caretaker.full_name, expiresAt: expiresAt.toISOString() };
  });

export const listCaretakerAssignedProperties = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(16) }))
  .handler(async ({ data }) => {
    const caretaker = await resolveCaretakerFromToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assignments } = await supabaseAdmin
      .from("caretaker_property_assignments")
      .select("property_id")
      .eq("caretaker_id", caretaker.id);
    const propertyIds = (assignments ?? []).map((a) => a.property_id);
    if (!propertyIds.length) return [];
    const { data: properties } = await supabaseAdmin
      .from("properties")
      .select("*")
      .in("id", propertyIds);
    return properties ?? [];
  });

export const updateCaretakerVacancy = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string().min(16),
      propertyId: z.string().uuid(),
      isVacant: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const caretaker = await resolveCaretakerFromToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assignment } = await supabaseAdmin
      .from("caretaker_property_assignments")
      .select("id")
      .eq("caretaker_id", caretaker.id)
      .eq("property_id", data.propertyId)
      .maybeSingle();
    if (!assignment) throw new Error("Property not assigned to you");

    const { error } = await supabaseAdmin
      .from("properties")
      .update({ is_vacant: data.isVacant })
      .eq("id", data.propertyId)
      .eq("owner_id", caretaker.landlord_id);
    if (error) throw error;
    return { ok: true };
  });

export const validateCaretakerSession = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(16) }))
  .handler(async ({ data }) => {
    const caretaker = await resolveCaretakerFromToken(data.token);
    return { valid: true, name: caretaker.full_name };
  });
