import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;
type PropertyUpdate = Database["public"]["Tables"]["properties"]["Update"];
type PropertyType = Database["public"]["Enums"]["property_type"];

const apiKeyBuckets = new Map<string, { count: number; resetAt: number }>();
const LISTING_ID_RE = /^\/listings\/([0-9a-f-]{36})$/;

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

function readString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function readOptionalString(value: unknown): string | null {
  if (value == null || value === "") return null;
  return readString(value);
}

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function buildListingPatch(body: Record<string, unknown>): PropertyUpdate {
  const patch: PropertyUpdate = {};
  if (body.title !== undefined) patch.title = readString(body.title);
  if (body.rent_kes !== undefined) patch.rent_kes = Number(body.rent_kes);
  if (body.neighborhood !== undefined) patch.neighborhood = readString(body.neighborhood);
  if (body.description !== undefined) patch.description = readOptionalString(body.description);
  if (body.bedrooms !== undefined) patch.bedrooms = Number(body.bedrooms);
  if (body.bathrooms !== undefined) patch.bathrooms = Number(body.bathrooms);
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);
  return patch;
}

async function handleSyncStatus(admin: Admin, auth: ApiKeyAuth): Promise<Response> {
  const { count } = await admin
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", auth.userId);
  return json({ lastSync: new Date().toISOString(), listingCount: count ?? 0 });
}

async function handleListingsGet(admin: Admin, auth: ApiKeyAuth, url: URL): Promise<Response> {
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const neighborhood = url.searchParams.get("neighborhood");

  let query = admin
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

async function handleListingGet(admin: Admin, auth: ApiKeyAuth, id: string): Promise<Response> {
  const { data, error } = await admin
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("owner_id", auth.userId)
    .maybeSingle();
  if (error) return errorJson(error.message, "DB_ERROR", 500);
  if (!data) return errorJson("Not found", "NOT_FOUND", 404);
  return json(data);
}

async function handleListingPut(
  admin: Admin,
  auth: ApiKeyAuth,
  id: string,
  request: Request,
): Promise<Response> {
  const body = readRecord(await request.json());
  const { data, error } = await admin
    .from("properties")
    .update(buildListingPatch(body))
    .eq("id", id)
    .eq("owner_id", auth.userId)
    .select("*")
    .maybeSingle();
  if (error) return errorJson(error.message, "DB_ERROR", 500);
  if (!data) return errorJson("Not found", "NOT_FOUND", 404);
  return json(data);
}

async function handleListingDelete(admin: Admin, auth: ApiKeyAuth, id: string): Promise<Response> {
  const { error } = await admin
    .from("properties")
    .update({ is_active: false })
    .eq("id", id)
    .eq("owner_id", auth.userId);
  if (error) return errorJson(error.message, "DB_ERROR", 500);
  return json({ archived: true });
}

async function handleListingsPost(
  admin: Admin,
  auth: ApiKeyAuth,
  request: Request,
): Promise<Response> {
  const body = readRecord(await request.json());
  const title = readString(body.title);
  const neighborhood = readString(body.neighborhood);
  const rentKes = Number(body.rent_kes);

  if (!title || !neighborhood || !rentKes) {
    return errorJson("title, neighborhood, rent_kes required", "VALIDATION", 400);
  }

  const rawType = body.property_type;
  const propertyType: PropertyType =
    typeof rawType === "string" && rawType.length > 0 ? (rawType as PropertyType) : "one_bedroom";

  const { data, error } = await admin
    .from("properties")
    .insert({
      title,
      neighborhood,
      rent_kes: rentKes,
      rent_kes_max: null,
      bedrooms: Number(body.bedrooms ?? 1),
      bathrooms: Number(body.bathrooms ?? 1),
      property_type: propertyType,
      description: readOptionalString(body.description),
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

async function handleWebhooksPost(
  admin: Admin,
  auth: ApiKeyAuth,
  request: Request,
): Promise<Response> {
  const body = readRecord(await request.json());
  const webhookUrl = readString(body.url);
  if (!webhookUrl) return errorJson("url required", "VALIDATION", 400);

  const events = Array.isArray(body.events)
    ? body.events.filter((e): e is string => typeof e === "string")
    : ["listing.created", "listing.updated"];

  const { data, error } = await admin
    .from("integration_webhooks")
    .insert({
      user_id: auth.userId,
      url: webhookUrl,
      events,
    })
    .select("*")
    .single();
  if (error) return errorJson(error.message, "DB_ERROR", 500);
  return json(data, 201);
}

async function handleListingById(
  admin: Admin,
  auth: ApiKeyAuth,
  request: Request,
  id: string,
): Promise<Response | null> {
  if (request.method === "GET") return handleListingGet(admin, auth, id);
  if (request.method === "PUT") return handleListingPut(admin, auth, id, request);
  if (request.method === "DELETE") return handleListingDelete(admin, auth, id);
  return null;
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
    return handleSyncStatus(supabaseAdmin, auth);
  }

  if (path === "/listings" && request.method === "GET") {
    return handleListingsGet(supabaseAdmin, auth, url);
  }

  if (path === "/listings" && request.method === "POST") {
    return handleListingsPost(supabaseAdmin, auth, request);
  }

  if (path === "/webhooks" && request.method === "POST") {
    return handleWebhooksPost(supabaseAdmin, auth, request);
  }

  const listingMatch = LISTING_ID_RE.exec(path);
  if (listingMatch) {
    const listingResponse = await handleListingById(supabaseAdmin, auth, request, listingMatch[1]);
    if (listingResponse) return listingResponse;
  }

  return errorJson("Not found", "NOT_FOUND", 404);
}
