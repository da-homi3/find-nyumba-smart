import { parseUuid } from "@/lib/api/mobile/v1/helpers";
import type { PropertySearchFilters } from "@/lib/properties";
import {
  mobileError,
  mobileJson,
  requireFlutterClient,
  requireMobileBearer,
  type MobileAdmin,
} from "@/lib/api/mobile/v1/auth";
import { ForbiddenError, requireRole } from "@/lib/api/_authz";

export { userHasRole } from "@/lib/api/mobile/v1/auth";

function trimTrailingSlashes(pathname: string): string {
  let path = pathname;
  while (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path || "/";
}

function parseBoundedInt(raw: string | null, fallback: number): number {
  const n = Number(raw ?? String(fallback));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function parseSortBy(raw: string | null): PropertySearchFilters["sortBy"] {
  if (
    raw === "nearby" ||
    raw === "newest" ||
    raw === "price_asc" ||
    raw === "price_desc" ||
    raw === "score"
  ) {
    return raw;
  }
  return "newest";
}

async function buildListingsFilters(url: URL): Promise<PropertySearchFilters> {
  const { propertyTypeSchema } = await import("@/lib/api/nyumba/nyumba-shared");
  const { normalizeNeighborhoodFilter } = await import("@/lib/security/neighborhoods");

  const typeRaw = url.searchParams.get("type");
  const typesRaw = url.searchParams.get("types");
  const parsedType = typeRaw ? propertyTypeSchema.safeParse(typeRaw) : null;
  const propertyTypes = typesRaw
    ? typesRaw
        .split(",")
        .map((t) => t.trim())
        .map((t) => propertyTypeSchema.safeParse(t))
        .flatMap((r) => (r.success ? [r.data] : []))
    : undefined;

  const pricingModeRaw = url.searchParams.get("pricingMode");
  const pricingMode: "rent" | "sale" | undefined =
    pricingModeRaw === "rent" || pricingModeRaw === "sale" ? pricingModeRaw : undefined;

  const originLat = Number(url.searchParams.get("originLat") ?? Number.NaN);
  const originLng = Number(url.searchParams.get("originLng") ?? Number.NaN);
  const maxImagesParsed = Number(url.searchParams.get("maxImages") ?? Number.NaN);
  const minBedroomsRaw = url.searchParams.get("minBedrooms");

  return {
    limit: parseBoundedInt(url.searchParams.get("limit"), 50),
    offset: parseBoundedInt(url.searchParams.get("offset"), 0),
    query: url.searchParams.get("q") ?? undefined,
    neighborhood: normalizeNeighborhoodFilter(url.searchParams.get("neighborhood")) ?? undefined,
    locationId: url.searchParams.get("locationId") ?? undefined,
    countyLocationId: url.searchParams.get("countyLocationId") ?? undefined,
    constituencyLocationId: url.searchParams.get("constituencyLocationId") ?? undefined,
    wardLocationId: url.searchParams.get("wardLocationId") ?? undefined,
    propertyType: parsedType?.success ? parsedType.data : undefined,
    propertyTypes: propertyTypes && propertyTypes.length > 0 ? propertyTypes : undefined,
    pricingMode,
    minRent: url.searchParams.get("minRent") ? Number(url.searchParams.get("minRent")) : undefined,
    maxRent: url.searchParams.get("maxRent") ? Number(url.searchParams.get("maxRent")) : undefined,
    verifiedOnly: url.searchParams.get("verifiedOnly") === "1",
    minBedrooms: minBedroomsRaw ? Number(minBedroomsRaw) : undefined,
    maxImages: Number.isFinite(maxImagesParsed)
      ? Math.min(5, Math.max(0, Math.trunc(maxImagesParsed)))
      : undefined,
    sortBy: parseSortBy(url.searchParams.get("sortBy")),
    originLat: Number.isFinite(originLat) ? originLat : undefined,
    originLng: Number.isFinite(originLng) ? originLng : undefined,
  };
}

async function handleMe(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    auth.admin
      .from("profiles")
      .select(
        "id, full_name, phone, active_portal, is_portal_active, avatar_url, trial_unlocks_remaining, trial_ends_at",
      )
      .eq("id", auth.userId)
      .maybeSingle(),
    auth.admin.from("user_roles").select("role").eq("user_id", auth.userId),
  ]);

  return mobileJson({
    apiVersion: "v1",
    user: {
      id: auth.userId,
      email: auth.user.email ?? null,
      phone: auth.user.phone ?? null,
    },
    profile: profile ?? null,
    roles: (roleRows ?? []).map((r) => r.role),
  });
}

async function handleListings(req: Request): Promise<Response> {
  const { queryListings } = await import("@/lib/api/listings-core");
  const filters = await buildListingsFilters(new URL(req.url));
  const result = await queryListings(filters);
  return mobileJson({
    apiVersion: "v1",
    items: result.items,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
}

async function handleListingDetail(req: Request, id: string): Promise<Response> {
  const { createPublicClient, PROPERTY_DETAIL_COLUMNS } = await import("@/lib/api/public-client");
  const { mapPropertyRow } = await import("@/lib/api/nyumba/nyumba-shared");

  const supabase = createPublicClient();
  const { data: property, error } = await supabase
    .from("properties")
    .select(PROPERTY_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("mobile listing detail:", error.message);
    return mobileError("Could not load listing", "LISTING_ERROR", 500);
  }
  if (!property?.is_active) {
    return mobileError("Listing not found", "NOT_FOUND", 404);
  }

  const mapped = mapPropertyRow(property);

  // Same fire-and-forget view recording as web getProperty.
  void (async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("record_property_view", {
        _property_id: property.id,
        _session_id: undefined,
        _source: "mobile-property-detail",
      });
    } catch (viewErr) {
      console.warn("record_property_view failed:", viewErr);
    }
  })();

  return mobileJson({ apiVersion: "v1", listing: mapped });
}

async function assertTenantAccess(admin: MobileAdmin, userId: string): Promise<void> {
  // Service-role client: requireRole still works (filters by user_id).
  await requireRole(admin, userId, "tenant");
}

async function handleListSaved(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  try {
    await assertTenantAccess(auth.admin, auth.userId);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return mobileError(err.message, "FORBIDDEN", 403);
    }
    throw err;
  }

  const { mapPropertyRow } = await import("@/lib/api/nyumba/nyumba-shared");
  const { data, error } = await auth.admin
    .from("saved_properties")
    .select("properties(*)")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("mobile saved list:", error.message);
    return mobileError("Could not load saved properties", "SAVED_ERROR", 500);
  }

  const items = (data ?? [])
    .map((row) => (row.properties ? mapPropertyRow(row.properties) : null))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return mobileJson({ apiVersion: "v1", items });
}

async function handleSaveProperty(
  req: Request,
  propertyId: string,
  save: boolean,
): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  try {
    await assertTenantAccess(auth.admin, auth.userId);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return mobileError(err.message, "FORBIDDEN", 403);
    }
    throw err;
  }

  const { data: existing, error: existingError } = await auth.admin
    .from("saved_properties")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (existingError) {
    return mobileError("Could not update saved property", "SAVED_ERROR", 500);
  }

  if (save && !existing) {
    const { error } = await auth.admin
      .from("saved_properties")
      .insert({ user_id: auth.userId, property_id: propertyId });
    if (error) return mobileError("Could not save property", "SAVED_ERROR", 500);
  }

  if (!save && existing) {
    const { error } = await auth.admin
      .from("saved_properties")
      .delete()
      .eq("user_id", auth.userId)
      .eq("property_id", propertyId);
    if (error) return mobileError("Could not remove saved property", "SAVED_ERROR", 500);
  }

  return mobileJson({ apiVersion: "v1", saved: save, propertyId });
}

async function handleUnlockGet(req: Request, listingId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const { getListingUnlockStateCore } = await import("@/lib/payments/contact-unlock-core");
  const state = await getListingUnlockStateCore(auth.admin, auth.userId, listingId);
  return mobileJson({ apiVersion: "v1", ...state, listingId });
}

async function handleUnlockPost(req: Request, listingId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  let body: {
    method?: "mpesa" | "card";
    phoneNumber?: string;
    email?: string;
    idempotencyKey?: string;
  } = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as typeof body;
  } catch {
    return mobileError("Invalid JSON", "BAD_REQUEST", 400);
  }

  try {
    const { unlockListingContactCore } = await import("@/lib/payments/contact-unlock-core");
    const result = await unlockListingContactCore(auth.admin, auth.userId, {
      listingId,
      method: body.method,
      phoneNumber: body.phoneNumber,
      email: body.email,
      idempotencyKey: body.idempotencyKey,
    });
    return mobileJson({ apiVersion: "v1", listingId, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unlock failed";
    console.error("mobile unlock:", message);
    return mobileError(message, "UNLOCK_ERROR", 400);
  }
}

async function handlePaymentStatus(req: Request, paymentId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  try {
    const { verifyPaymentStatusCore } = await import("@/lib/payments/contact-unlock-core");
    const result = await verifyPaymentStatusCore(auth.admin, auth.userId, paymentId);
    return mobileJson({ apiVersion: "v1", ...result });
  } catch (err) {
    console.error("mobile payment status:", err);
    return mobileError("Payment not found", "NOT_FOUND", 404);
  }
}

async function handleFcmToken(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  let body: { token?: string };
  try {
    body = (await req.json()) as { token?: string };
  } catch {
    return mobileError("Invalid JSON", "BAD_REQUEST", 400);
  }

  const token = body.token?.trim();
  if (!token) return mobileError("token required", "BAD_REQUEST", 400);

  const { registerFcmToken } = await import("@/lib/api/mobile-fcm");
  const result = await registerFcmToken(auth.admin, auth.userId, token);
  await auth.admin
    .from("push_tokens")
    .upsert({ user_id: auth.userId, token, platform: "flutter" }, { onConflict: "user_id,token" });

  const sendEnabled = process.env.FCM_SEND_ENABLED === "true";
  return mobileJson({ apiVersion: "v1", ok: true, ...result, sendEnabled });
}

type WaveHandler = (req: Request, rest: string, method: string) => Promise<Response | null>;

function matchUuidSegment(rest: string, prefix: string): string | null | undefined {
  if (!rest.startsWith(prefix)) return undefined;
  const idPart = rest.slice(prefix.length);
  if (!idPart || idPart.includes("/")) return undefined;
  return parseUuid(idPart);
}

type UuidRoute = {
  prefix: string;
  methods: readonly string[];
  invalidMessage: string;
  handle: (req: Request, id: string, method: string) => Promise<Response>;
};

const UUID_ROUTES: readonly UuidRoute[] = [
  {
    prefix: "/listings/",
    methods: ["GET"],
    invalidMessage: "Invalid listing id",
    handle: (req, id) => handleListingDetail(req, id),
  },
  {
    prefix: "/saved/",
    methods: ["PUT", "DELETE"],
    invalidMessage: "Invalid property id",
    handle: (req, id, method) => handleSaveProperty(req, id, method === "PUT"),
  },
  {
    prefix: "/unlock/",
    methods: ["GET", "POST"],
    invalidMessage: "Invalid listing id",
    handle: (req, id, method) =>
      method === "GET" ? handleUnlockGet(req, id) : handleUnlockPost(req, id),
  },
  {
    prefix: "/payments/",
    methods: ["GET"],
    invalidMessage: "Invalid payment id",
    handle: (req, id) => handlePaymentStatus(req, id),
  },
];

async function tryParamMobileRoutes(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  for (const route of UUID_ROUTES) {
    if (!route.methods.includes(method)) continue;
    const id = matchUuidSegment(rest, route.prefix);
    if (id === undefined) continue;
    if (id === null) return mobileError(route.invalidMessage, "BAD_REQUEST", 400);
    return route.handle(req, id, method);
  }
  return null;
}

async function tryCoreMobileRoutes(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const exact: Record<string, (r: Request) => Promise<Response>> = {
    "GET /me": handleMe,
    "GET /listings": handleListings,
    "GET /saved": handleListSaved,
    "POST /fcm-token": handleFcmToken,
    "GET /health": async () =>
      mobileJson({ apiVersion: "v1", status: "ok", service: "mobile-bff" }),
  };

  const exactHandler = exact[`${method} ${rest}`];
  if (exactHandler) return exactHandler(req);

  return tryParamMobileRoutes(req, rest, method);
}

async function tryWaveRoutes(req: Request, rest: string, method: string): Promise<Response | null> {
  const loaders: Array<() => Promise<WaveHandler>> = [
    async () => (await import("@/lib/api/mobile/v1/wave1")).tryHandleWave1,
    async () => (await import("@/lib/api/mobile/v1/wave2")).tryHandleWave2,
    async () => (await import("@/lib/api/mobile/v1/wave3")).tryHandleWave3,
    async () => (await import("@/lib/api/mobile/v1/wave4")).tryHandleWave4,
    async () => (await import("@/lib/api/mobile/v1/wave5")).tryHandleWave5,
    async () => (await import("@/lib/api/mobile/v1/wave6")).tryHandleWave6,
    async () => (await import("@/lib/api/mobile/v1/wave7")).tryHandleWave7,
    async () => (await import("@/lib/api/mobile/v1/wave8")).tryHandleWave8,
    async () => (await import("@/lib/api/mobile/v1/wave9")).tryHandleWave9,
    async () => (await import("@/lib/api/mobile/v1/wave10")).tryHandleWave10,
    async () => (await import("@/lib/api/mobile/v1/wave11")).tryHandleWave11,
    async () => (await import("@/lib/api/mobile/v1/wave12")).tryHandleWave12,
    async () => (await import("@/lib/api/mobile/v1/wave13")).tryHandleWave13,
    async () => (await import("@/lib/api/mobile/v1/wave14")).tryHandleWave14,
    async () => (await import("@/lib/api/mobile/v1/wave15")).tryHandleWave15,
    async () => (await import("@/lib/api/mobile/v1/wave16")).tryHandleWave16,
    async () => (await import("@/lib/api/mobile/v1/wave17")).tryHandleWave17,
    async () => (await import("@/lib/api/mobile/v1/wave18")).tryHandleWave18,
    async () => (await import("@/lib/api/mobile/v1/wave19")).tryHandleWave19,
    async () => (await import("@/lib/api/mobile/v1/wave20")).tryHandleWave20,
    async () => (await import("@/lib/api/mobile/v1/wave21")).tryHandleWave21,
    async () => (await import("@/lib/api/mobile/v1/wave22")).tryHandleWave22,
  ];

  for (const load of loaders) {
    const handler = await load();
    const wave = await handler(req, rest, method);
    if (wave) return wave;
  }
  return null;
}

/**
 * Mobile BFF v1 — Tenant MVP endpoints for Flutter.
 * Website createServerFn handlers remain the web path; this is additive REST.
 */
export async function handleMobileV1Api(req: Request): Promise<Response> {
  const clientErr = requireFlutterClient(req);
  if (clientErr) return clientErr;

  const path = trimTrailingSlashes(new URL(req.url).pathname);
  const prefix = "/api/mobile/v1";
  if (!path.startsWith(prefix)) {
    return mobileError("Not found", "NOT_FOUND", 404);
  }

  const rest = path.slice(prefix.length) || "/";
  const method = req.method.toUpperCase();

  try {
    const core = await tryCoreMobileRoutes(req, rest, method);
    if (core) return core;

    const wave = await tryWaveRoutes(req, rest, method);
    if (wave) return wave;

    return mobileError("Not found", "NOT_FOUND", 404);
  } catch (err) {
    console.error("Mobile BFF v1 error:", err);
    return mobileError("Internal server error", "INTERNAL", 500);
  }
}
