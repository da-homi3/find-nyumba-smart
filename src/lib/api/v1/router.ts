import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

const apiKeyBuckets = new Map<string, { count: number; resetAt: number }>();

export type ApiKeyAuth = {
  userId: string;
  keyId: string;
  scope: string;
};

export async function hashApiKey(raw: string): Promise<string> {
  const buf = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function authenticateApiKey(
  admin: Admin,
  request: Request,
): Promise<ApiKeyAuth | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const raw = auth.slice(7).trim();
  if (!raw.startsWith("nsk_")) return null;

  const keyHash = await hashApiKey(raw);
  const { data } = await admin
    .from("integration_api_keys")
    .select("id, user_id, scope, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!data || data.revoked_at) return null;
  return { userId: data.user_id, keyId: data.id, scope: data.scope };
}

export function checkApiKeyRateLimit(keyId: string): void {
  const now = Date.now();
  const bucket = apiKeyBuckets.get(keyId);
  const max = 100;
  const windowMs = 60_000;

  if (!bucket || now > bucket.resetAt) {
    apiKeyBuckets.set(keyId, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > max) {
    throw new Error("Rate limit exceeded (100/min)");
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorJson(message: string, code: string, status: number): Response {
  return json({ error: message, code, status }, status);
}

export async function handleV1Api(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/v1/, "") || "/";

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const auth = await authenticateApiKey(supabaseAdmin, request);
  if (!auth) {
    return errorJson("Unauthorized", "UNAUTHORIZED", 401);
  }

  try {
    checkApiKeyRateLimit(auth.keyId);
  } catch {
    return errorJson("Too many requests", "RATE_LIMIT", 429);
  }

  if (path === "/sync/status" && request.method === "GET") {
    const { count } = await supabaseAdmin
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", auth.userId);
    return json({ lastSync: new Date().toISOString(), listingCount: count ?? 0 });
  }

  if (path === "/listings" && request.method === "GET") {
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const neighborhood = url.searchParams.get("neighborhood");

    let query = supabaseAdmin
      .from("properties")
      .select("*", { count: "exact" })
      .eq("owner_id", auth.userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (neighborhood) query = query.eq("neighborhood", neighborhood);

    const { data, error, count } = await query;
    if (error) return errorJson(error.message, "DB_ERROR", 500);
    return json({ items: data ?? [], total: count ?? 0, limit, offset });
  }

  const listingMatch = path.match(/^\/listings\/([0-9a-f-]{36})$/);
  if (listingMatch) {
    const id = listingMatch[1];

    if (request.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("properties")
        .select("*")
        .eq("id", id)
        .eq("owner_id", auth.userId)
        .maybeSingle();
      if (error) return errorJson(error.message, "DB_ERROR", 500);
      if (!data) return errorJson("Not found", "NOT_FOUND", 404);
      return json(data);
    }

    if (request.method === "PUT") {
      const body = (await request.json()) as Record<string, unknown>;
      const allowed = [
        "title",
        "rent_kes",
        "neighborhood",
        "description",
        "bedrooms",
        "bathrooms",
        "is_active",
      ];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      const { data, error } = await supabaseAdmin
        .from("properties")
        .update(patch)
        .eq("id", id)
        .eq("owner_id", auth.userId)
        .select("*")
        .maybeSingle();
      if (error) return errorJson(error.message, "DB_ERROR", 500);
      if (!data) return errorJson("Not found", "NOT_FOUND", 404);
      return json(data);
    }

    if (request.method === "DELETE") {
      const { error } = await supabaseAdmin
        .from("properties")
        .update({ is_active: false })
        .eq("id", id)
        .eq("owner_id", auth.userId);
      if (error) return errorJson(error.message, "DB_ERROR", 500);
      return json({ archived: true });
    }
  }

  if (path === "/listings" && request.method === "POST") {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.title || !body.neighborhood || !body.rent_kes) {
      return errorJson("title, neighborhood, rent_kes required", "VALIDATION", 400);
    }
    const { data, error } = await supabaseAdmin
      .from("properties")
      .insert({
        title: String(body.title),
        neighborhood: String(body.neighborhood),
        rent_kes: Number(body.rent_kes),
        bedrooms: Number(body.bedrooms ?? 1),
        bathrooms: Number(body.bathrooms ?? 1),
        property_type: (body.property_type as string) ?? "one_bedroom",
        description: body.description ? String(body.description) : null,
        owner_id: auth.userId,
        is_active: false,
        images: [],
        amenities: [],
      })
      .select("*")
      .single();
    if (error) return errorJson(error.message, "DB_ERROR", 500);
    return json(data, 201);
  }

  if (path === "/webhooks" && request.method === "POST") {
    const body = (await request.json()) as { url?: string; events?: string[] };
    if (!body.url) return errorJson("url required", "VALIDATION", 400);
    const { data, error } = await supabaseAdmin
      .from("integration_webhooks")
      .insert({
        user_id: auth.userId,
        url: body.url,
        events: body.events ?? ["listing.created", "listing.updated"],
      })
      .select("*")
      .single();
    if (error) return errorJson(error.message, "DB_ERROR", 500);
    return json(data, 201);
  }

  return errorJson("Not found", "NOT_FOUND", 404);
}
