import { parseUuid, parseJsonBody } from "@/lib/api/mobile/v1/helpers";
import {
  mobileError,
  mobileJson,
  requireMobileBearer,
  userHasRole,
  type MobileAdmin,
} from "@/lib/api/mobile/v1/auth";
import type { Database } from "@/integrations/supabase/types";
import { MAINTENANCE_CATEGORIES, MAINTENANCE_PRIORITIES } from "@/lib/maintenance/state-machine";
import { asPmDb } from "@/lib/pm/access";
import { notifyOwnerNewMaintenance } from "@/lib/maintenance/notify";
import { notifyOwnerNewComplaint } from "@/lib/pm/complaints-notify";

type AppRole = Database["public"]["Enums"]["app_role"];

const LISTER_ROLES = ["landlord", "agency", "manager", "admin"] as const;

async function requireListerOrAdmin(admin: MobileAdmin, userId: string): Promise<Response | null> {
  for (const role of LISTER_ROLES) {
    if (await userHasRole(admin, userId, role as AppRole)) return null;
  }
  return mobileError("Lister role required", "FORBIDDEN", 403);
}

async function activeTenantLeaseContext(admin: ReturnType<typeof asPmDb>, userId: string) {
  const { data: tenants } = await admin
    .from("pm_tenants")
    .select("id, full_name, property_id")
    .eq("tenant_user_id", userId)
    .eq("portal_status", "accepted")
    .is("deleted_at", null);

  if (!tenants?.length) return null;

  const tenantIds = tenants.map((t: { id: string }) => t.id);
  const { data: leases } = await admin
    .from("pm_leases")
    .select("id, unit_id, tenant_id")
    .in("tenant_id", tenantIds)
    .eq("status", "active");

  if (!leases?.length) return null;

  const lease = leases[0] as { id: string; unit_id: string; tenant_id: string };
  const tenant = tenants.find((t: { id: string }) => t.id === lease.tenant_id) as
    | { id: string; full_name: string; property_id: string }
    | undefined;
  if (!tenant) return null;

  const { data: unit } = await admin
    .from("pm_units")
    .select("id, unit_label, property_id")
    .eq("id", lease.unit_id)
    .maybeSingle();
  if (!unit) return null;

  return { lease, tenant, unit };
}

// ── Tenant maintenance ───────────────────────────────────────────────────────

async function handleListTenantMaintenance(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const admin = asPmDb(auth.admin);
  const { data: tenants } = await admin
    .from("pm_tenants")
    .select("id")
    .eq("tenant_user_id", auth.userId)
    .eq("portal_status", "accepted")
    .is("deleted_at", null);

  if (!tenants?.length) return mobileJson({ apiVersion: "v1", items: [] });

  const tenantIds = tenants.map((t: { id: string }) => t.id);
  const { data: rows, error } = await admin
    .from("pm_maintenance_requests")
    .select("*")
    .in("tenant_id", tenantIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("mobile tenant maintenance list:", error.message);
    return mobileError("Could not load maintenance requests", "MAINTENANCE_ERROR", 500);
  }

  const unitIds = [...new Set((rows ?? []).map((r: { unit_id: string }) => r.unit_id))];
  const { data: units } = unitIds.length
    ? await admin.from("pm_units").select("id, unit_label, property_id").in("id", unitIds)
    : { data: [] };

  const propertyIds = [
    ...new Set((units ?? []).map((u: { property_id: string }) => u.property_id)),
  ];
  const { data: properties } = propertyIds.length
    ? await admin.from("pm_properties").select("id, name").in("id", propertyIds)
    : { data: [] };

  const unitById = new Map(
    (units ?? []).map((u: { id: string; unit_label: string; property_id: string }) => [u.id, u]),
  );
  const propById = new Map((properties ?? []).map((p: { id: string; name: string }) => [p.id, p]));

  const items = (rows ?? []).map((r: Record<string, unknown>) => {
    const unit = unitById.get(r.unit_id as string);
    const property = unit ? propById.get(unit.property_id) : undefined;
    return {
      id: r.id as string,
      category: r.category as string,
      description: r.description as string,
      priority: r.priority as string,
      status: r.status as string,
      photos: (r.photos as string[]) ?? [],
      unitLabel: unit?.unit_label ?? null,
      propertyName: property?.name ?? null,
      createdAt: r.created_at as string,
      completedAt: (r.completed_at as string | null) ?? null,
    };
  });

  return mobileJson({ apiVersion: "v1", items });
}

async function handleCreateTenantMaintenance(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{
    category?: string;
    priority?: string;
    description?: string;
    photos?: string[];
  }>(req);
  if (body instanceof Response) return body;

  const category = body.category;
  if (!category || !(MAINTENANCE_CATEGORIES as readonly string[]).includes(category)) {
    return mobileError(
      `category must be one of: ${MAINTENANCE_CATEGORIES.join(", ")}`,
      "BAD_REQUEST",
      400,
    );
  }

  const priority = body.priority ?? "normal";
  if (!(MAINTENANCE_PRIORITIES as readonly string[]).includes(priority)) {
    return mobileError(
      `priority must be one of: ${MAINTENANCE_PRIORITIES.join(", ")}`,
      "BAD_REQUEST",
      400,
    );
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length < 5 || description.length > 2000) {
    return mobileError("description must be 5–2000 characters", "BAD_REQUEST", 400);
  }

  const photos = Array.isArray(body.photos)
    ? body.photos.filter((u): u is string => typeof u === "string").slice(0, 5)
    : [];

  const admin = asPmDb(auth.admin);
  const ctx = await activeTenantLeaseContext(admin, auth.userId);
  if (!ctx?.tenant) {
    return mobileError("No active lease found for this account", "FORBIDDEN", 403);
  }

  const { data: inserted, error } = await admin
    .from("pm_maintenance_requests")
    .insert({
      unit_id: ctx.lease.unit_id,
      tenant_id: ctx.tenant.id,
      category,
      priority,
      description,
      photos,
      status: "reported",
    })
    .select("id")
    .single();

  if (error) {
    console.error("mobile create maintenance:", error.message);
    return mobileError(error.message, "MAINTENANCE_ERROR", 400);
  }

  try {
    await notifyOwnerNewMaintenance(admin, inserted.id);
  } catch (err) {
    console.warn("[mobile maintenance] owner notify failed", err);
  }

  return mobileJson({ apiVersion: "v1", requestId: inserted.id }, 201);
}

// ── Tenant complaints ────────────────────────────────────────────────────────

async function handleListTenantComplaints(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const admin = asPmDb(auth.admin);
  const { data: tenants } = await admin
    .from("pm_tenants")
    .select("id")
    .eq("tenant_user_id", auth.userId)
    .eq("portal_status", "accepted")
    .is("deleted_at", null);

  if (!tenants?.length) return mobileJson({ apiVersion: "v1", items: [] });

  const tenantIds = tenants.map((t: { id: string }) => t.id);
  const { data: rows, error } = await admin
    .from("pm_complaints")
    .select("*")
    .in("tenant_id", tenantIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("mobile tenant complaints list:", error.message);
    return mobileError("Could not load complaints", "COMPLAINTS_ERROR", 500);
  }

  const unitIds = [...new Set((rows ?? []).map((r: { unit_id: string }) => r.unit_id))];
  const { data: units } = unitIds.length
    ? await admin.from("pm_units").select("id, unit_label, property_id").in("id", unitIds)
    : { data: [] };

  const propertyIds = [
    ...new Set((units ?? []).map((u: { property_id: string }) => u.property_id)),
  ];
  const { data: properties } = propertyIds.length
    ? await admin.from("pm_properties").select("id, name").in("id", propertyIds)
    : { data: [] };

  const unitById = new Map(
    (units ?? []).map((u: { id: string; unit_label: string; property_id: string }) => [u.id, u]),
  );
  const propById = new Map((properties ?? []).map((p: { id: string; name: string }) => [p.id, p]));

  const items = (rows ?? []).map((r: Record<string, unknown>) => {
    const unit = unitById.get(r.unit_id as string);
    const property = unit ? propById.get(unit.property_id) : undefined;
    return {
      id: r.id as string,
      subject: r.subject as string,
      body: r.body as string,
      status: r.status as string,
      photoUrl: (r.photo_url as string | null) ?? null,
      landlordReply: (r.landlord_reply as string | null) ?? null,
      unitLabel: unit?.unit_label ?? null,
      propertyName: property?.name ?? null,
      createdAt: r.created_at as string,
    };
  });

  return mobileJson({ apiVersion: "v1", items });
}

async function handleCreateTenantComplaint(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{
    subject?: string;
    body?: string;
    photoUrl?: string | null;
  }>(req);
  if (body instanceof Response) return body;

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  if (subject.length < 3 || subject.length > 120) {
    return mobileError("subject must be 3–120 characters", "BAD_REQUEST", 400);
  }

  const details = typeof body.body === "string" ? body.body.trim() : "";
  if (details.length < 5 || details.length > 4000) {
    return mobileError("body must be 5–4000 characters", "BAD_REQUEST", 400);
  }

  const photoUrl =
    typeof body.photoUrl === "string" && body.photoUrl.trim() ? body.photoUrl.trim() : null;

  const admin = asPmDb(auth.admin);
  const ctx = await activeTenantLeaseContext(admin, auth.userId);
  if (!ctx) {
    return mobileError("No active lease found for this account", "FORBIDDEN", 403);
  }

  const { data: inserted, error } = await admin
    .from("pm_complaints")
    .insert({
      property_id: ctx.unit.property_id,
      unit_id: ctx.lease.unit_id,
      tenant_id: ctx.tenant.id,
      lease_id: ctx.lease.id,
      subject,
      body: details,
      photo_url: photoUrl,
      status: "open",
    })
    .select("id")
    .single();

  if (error) {
    console.error("mobile create complaint:", error.message);
    return mobileError(error.message, "COMPLAINTS_ERROR", 400);
  }

  try {
    await notifyOwnerNewComplaint(admin, inserted.id);
  } catch (err) {
    console.warn("[mobile complaints] owner notify failed", err);
  }

  return mobileJson({ apiVersion: "v1", complaintId: inserted.id }, 201);
}

// ── Listing media (signed upload + attach) ───────────────────────────────────

async function assertOwnsProperty(
  admin: MobileAdmin,
  userId: string,
  propertyId: string,
): Promise<Response | { images: string[] }> {
  const roleErr = await requireListerOrAdmin(admin, userId);
  if (roleErr) return roleErr;

  const { data: row, error } = await admin
    .from("properties")
    .select("id, owner_id, images")
    .eq("id", propertyId)
    .maybeSingle();

  if (error) {
    console.error("mobile media property load:", error.message);
    return mobileError("Could not load property", "PROPERTY_ERROR", 500);
  }
  if (!row) return mobileError("Property not found", "NOT_FOUND", 404);

  const isAdmin = await userHasRole(admin, userId, "admin");
  if (row.owner_id !== userId && !isAdmin) {
    return mobileError("Not your property", "FORBIDDEN", 403);
  }

  return { images: Array.isArray(row.images) ? (row.images as string[]) : [] };
}

async function handleMediaUploadUrls(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const access = await assertOwnsProperty(auth.admin, auth.userId, propertyId);
  if (access instanceof Response) return access;

  const body = await parseJsonBody<{
    files?: Array<{ filename?: string; contentType?: string }>;
  }>(req);
  if (body instanceof Response) return body;

  const files = Array.isArray(body.files) ? body.files.slice(0, 12) : [];
  if (!files.length) {
    return mobileError("files array required (max 12)", "BAD_REQUEST", 400);
  }

  const uploads: Array<{
    path: string;
    token: string;
    signedUrl: string;
    contentType: string;
  }> = [];

  for (const file of files) {
    const rawName = typeof file.filename === "string" ? file.filename.trim() : "photo.jpg";
    const ext = (rawName.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "jpg";
    const contentType =
      typeof file.contentType === "string" && file.contentType.includes("/")
        ? file.contentType
        : `image/${ext === "png" ? "png" : "jpeg"}`;
    const path = `${auth.userId}/${propertyId}/img-${crypto.randomUUID()}.${ext}`;

    const { data: signed, error } = await auth.admin.storage
      .from("property-media")
      .createSignedUploadUrl(path, { upsert: false });

    if (error || !signed) {
      console.error("mobile signed upload:", error?.message);
      return mobileError("Could not create upload URL", "MEDIA_ERROR", 500);
    }

    uploads.push({
      path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      contentType,
    });
  }

  return mobileJson({ apiVersion: "v1", uploads });
}

async function handleAttachMedia(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const access = await assertOwnsProperty(auth.admin, auth.userId, propertyId);
  if (access instanceof Response) return access;

  const body = await parseJsonBody<{
    appendImages?: string[];
    appendPaths?: string[];
    images?: string[];
    videoUrl?: string | null;
    tourUrl?: string | null;
  }>(req);
  if (body instanceof Response) return body;

  let images = Array.isArray(body.images)
    ? body.images.filter((u): u is string => typeof u === "string" && u.startsWith("http"))
    : [...access.images];

  if (Array.isArray(body.appendImages)) {
    const append = body.appendImages.filter(
      (u): u is string => typeof u === "string" && u.startsWith("http"),
    );
    images = [...images, ...append];
  }

  if (Array.isArray(body.appendPaths) && body.appendPaths.length > 0) {
    const paths = body.appendPaths
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .filter((p) => p.startsWith(`${auth.userId}/`) || p.includes(`/${propertyId}/`))
      .slice(0, 12);

    if (paths.length) {
      const { data: signed, error: signErr } = await auth.admin.storage
        .from("property-media")
        .createSignedUrls(paths, 60 * 60 * 24 * 365);

      if (signErr) {
        console.error("mobile sign media paths:", signErr.message);
        return mobileError("Could not sign uploaded media", "MEDIA_ERROR", 500);
      }

      const urls = (signed ?? [])
        .map((s) => s?.signedUrl)
        .filter((u): u is string => typeof u === "string" && u.startsWith("http"));
      images = [...images, ...urls];
    }
  }

  images = [...new Set(images)].slice(0, 30);

  const patch: Database["public"]["Tables"]["properties"]["Update"] = {
    images,
    updated_at: new Date().toISOString(),
  };

  if ("videoUrl" in body) {
    if (body.videoUrl !== null && typeof body.videoUrl !== "string") {
      return mobileError("videoUrl must be a string or null", "BAD_REQUEST", 400);
    }
    patch.video_url = body.videoUrl?.trim() || null;
  }
  if ("tourUrl" in body) {
    if (body.tourUrl !== null && typeof body.tourUrl !== "string") {
      return mobileError("tourUrl must be a string or null", "BAD_REQUEST", 400);
    }
    patch.tour_url = body.tourUrl?.trim() || null;
  }

  const { data: row, error } = await auth.admin
    .from("properties")
    .update(patch)
    .eq("id", propertyId)
    .select("id, images, video_url, tour_url, updated_at")
    .single();

  if (error) {
    console.error("mobile attach media:", error.message);
    return mobileError("Could not update media", "MEDIA_ERROR", 500);
  }

  return mobileJson({ apiVersion: "v1", property: row });
}

/**
 * Wave 4 Mobile BFF — tenant maintenance/complaints + listing media.
 */
export async function tryHandleWave4(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  if (rest === "/tenants/maintenance" && method === "GET") {
    return handleListTenantMaintenance(req);
  }
  if (rest === "/tenants/maintenance" && method === "POST") {
    return handleCreateTenantMaintenance(req);
  }

  if (rest === "/tenants/complaints" && method === "GET") {
    return handleListTenantComplaints(req);
  }
  if (rest === "/tenants/complaints" && method === "POST") {
    return handleCreateTenantComplaint(req);
  }

  const mediaUpload = /^\/properties\/([^/]+)\/media\/upload-urls$/.exec(rest);
  if (mediaUpload && method === "POST") {
    const id = parseUuid(mediaUpload[1]);
    if (!id) return mobileError("Invalid property id", "BAD_REQUEST", 400);
    return handleMediaUploadUrls(req, id);
  }

  const mediaAttach = /^\/properties\/([^/]+)\/media$/.exec(rest);
  if (mediaAttach && method === "POST") {
    const id = parseUuid(mediaAttach[1]);
    if (!id) return mobileError("Invalid property id", "BAD_REQUEST", 400);
    return handleAttachMedia(req, id);
  }

  return null;
}
