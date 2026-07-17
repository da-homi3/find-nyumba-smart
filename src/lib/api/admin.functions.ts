import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { getAuthContext, profileFromMap } from "@/lib/api/server-context";
import { mapPropertyRows } from "@/lib/api/nyumba/nyumba-shared";
import { baseListingCap, getListingCap, resolveListingCap } from "@/lib/promo/listing-cap";
import { getActiveLandlordPlan } from "@/lib/revenue/subscription-store";
import { phonesFromProperty } from "@/lib/contact-phones";
import { fetchPresenceSnapshot } from "@/lib/presence/server";

async function loadListingCapProfilesByIds(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<
      string,
      {
        bonus_listing_slots: number;
        admin_listing_limit_override: number | null;
      }
    >();
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, bonus_listing_slots, admin_listing_limit_override")
    .in("id", userIds);
  return new Map(
    (data ?? []).map((row) => [
      row.id,
      {
        bonus_listing_slots: row.bonus_listing_slots ?? 0,
        admin_listing_limit_override: row.admin_listing_limit_override,
      },
    ]),
  );
}

async function assertListingAccountUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["landlord", "agency", "manager"]);
  if (!roleRows?.length) {
    throw new Error("User is not a landlord, agency, or property manager account");
  }
}

async function loadProfilesByIds(userIds: string[]) {
  if (userIds.length === 0)
    return new Map<
      string,
      { full_name: string | null; phone: string | null; avatar_url: string | null }
    >();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, avatar_url")
    .in("id", userIds);
  return new Map((data ?? []).map((p) => [p.id, p]));
}

function bumpLatest(map: Map<string, string>, id: string | null | undefined, at: string | null | undefined) {
  if (!id || !at) return;
  const current = map.get(id);
  if (!current || new Date(at).getTime() > new Date(current).getTime()) {
    map.set(id, at);
  }
}

function incrementCounter(map: Map<string, number>, key: string | null | undefined, delta = 1) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + delta);
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function isoMinutesAgo(minutes: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}

type PropertyMediaPathHelpers = {
  propertyMediaPathFromUrl: (url: string) => string | null;
  filenameFromMediaPath: (path: string, fallback: string) => string;
};

type AdminMediaItem = {
  kind: "image" | "video" | "tour";
  url: string;
  filename: string;
  path: string | null;
};

function collectImageMediaItems(
  images: string[] | null | undefined,
  helpers: PropertyMediaPathHelpers,
  items: AdminMediaItem[],
  pathsToSign: string[],
) {
  (images ?? []).forEach((imageUrl, index) => {
    const path = helpers.propertyMediaPathFromUrl(imageUrl);
    const filename = path
      ? helpers.filenameFromMediaPath(path, `image-${index + 1}.jpg`)
      : `image-${index + 1}.jpg`;
    items.push({ kind: "image", url: imageUrl, filename, path });
    if (path) pathsToSign.push(path);
  });
}

function collectLinkedMediaItems(
  links: Array<readonly ["video" | "tour", string | null | undefined]>,
  helpers: PropertyMediaPathHelpers,
  items: AdminMediaItem[],
  pathsToSign: string[],
) {
  for (const [kind, url] of links) {
    if (!url) continue;
    const path = helpers.propertyMediaPathFromUrl(url);
    const fallbackFilename = kind === "video" ? "video.mp4" : "tour.jpg";
    const filename = path ? helpers.filenameFromMediaPath(path, fallbackFilename) : fallbackFilename;
    items.push({ kind, url, filename, path });
    if (path) pathsToSign.push(path);
  }
}

async function signPropertyMediaPaths(
  supabaseAdmin: SupabaseClient,
  pathsToSign: string[],
) {
  const uniquePaths = [...new Set(pathsToSign)];
  const signedByPath = new Map<string, string>();
  if (uniquePaths.length === 0) return signedByPath;

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from("property-media")
    .createSignedUrls(uniquePaths, 60 * 30);
  if (signError) throw signError;
  for (const row of signed ?? []) {
    if (row.path && row.signedUrl) signedByPath.set(row.path, row.signedUrl);
  }
  return signedByPath;
}

function throwQueryErrors(results: Array<{ error: { message?: string } | null }>) {
  for (const result of results) {
    if (result.error) throw result.error;
  }
}

function addUniqueViewer(map: Map<string, Set<string>>, key: string, viewerId: string) {
  const viewers = map.get(key) ?? new Set<string>();
  viewers.add(viewerId);
  map.set(key, viewers);
}

function markActiveActor(
  userId: string | null | undefined,
  sessionId: string | null | undefined,
  tenantIdSet: Set<string>,
  activeUserIds: Set<string>,
  activeTenantIds: Set<string>,
  activeSessionIds: Set<string>,
) {
  if (userId) {
    activeUserIds.add(userId);
    if (tenantIdSet.has(userId)) activeTenantIds.add(userId);
  }
  if (sessionId) activeSessionIds.add(sessionId);
}

function markActiveIfRecent(
  rows: Array<{ userId: string; at: string }>,
  activeSince: string,
  tenantIdSet: Set<string>,
  activeUserIds: Set<string>,
  activeTenantIds: Set<string>,
) {
  for (const row of rows) {
    if (row.at < activeSince) continue;
    activeUserIds.add(row.userId);
    if (tenantIdSet.has(row.userId)) activeTenantIds.add(row.userId);
  }
}

function tenantStatusFromActivity(
  liveNow: boolean,
  lastActivityAt: string | null,
  recentSince: string,
): "live_now" | "active_30d" | "inactive" {
  if (liveNow) return "live_now";
  if (lastActivityAt && new Date(lastActivityAt).getTime() >= new Date(recentSince).getTime()) {
    return "active_30d";
  }
  return "inactive";
}

function buildActivityChartBuckets(
  chartWindowDays: number,
  propertyViews: Array<{ created_at: string }>,
  leads: Array<{ created_at: string }>,
  inquiries: Array<{ created_at: string }>,
  viewings: Array<{ created_at: string }>,
) {
  const chartBuckets = new Map<
    string,
    { label: string; propertyViews: number; leads: number; inquiries: number; viewings: number }
  >();
  for (let i = chartWindowDays - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    chartBuckets.set(key, {
      label: d.toLocaleDateString("en-KE", { weekday: "short" }),
      propertyViews: 0,
      leads: 0,
      inquiries: 0,
      viewings: 0,
    });
  }

  const bump = (
    rows: Array<{ created_at: string }>,
    field: "propertyViews" | "leads" | "inquiries" | "viewings",
  ) => {
    for (const row of rows) {
      const bucket = chartBuckets.get(row.created_at.slice(0, 10));
      if (bucket) bucket[field] += 1;
    }
  };

  bump(propertyViews, "propertyViews");
  bump(leads, "leads");
  bump(inquiries, "inquiries");
  bump(viewings, "viewings");
  return [...chartBuckets.values()];
}

function accumulatePropertyViewMetrics(args: {
  views: Array<{
    property_id: string;
    viewer_id: string | null;
    created_at: string;
  }>;
  propertyById: Map<string, { neighborhood: string }>;
  propertyRecentViewCount: Map<string, number>;
  propertyRecentUniqueViewers: Map<string, Set<string>>;
  areaRecentViewCount: Map<string, number>;
  areaRecentUniqueViewers: Map<string, Set<string>>;
  tenantLastActivity: Map<string, string>;
  tenantViewCount: Map<string, number>;
}) {
  for (const row of args.views) {
    incrementCounter(args.propertyRecentViewCount, row.property_id);
    if (row.viewer_id) {
      addUniqueViewer(args.propertyRecentUniqueViewers, row.property_id, row.viewer_id);
      bumpLatest(args.tenantLastActivity, row.viewer_id, row.created_at);
      incrementCounter(args.tenantViewCount, row.viewer_id);
    }
    const property = args.propertyById.get(row.property_id);
    if (!property) continue;
    incrementCounter(args.areaRecentViewCount, property.neighborhood);
    if (row.viewer_id) {
      addUniqueViewer(args.areaRecentUniqueViewers, property.neighborhood, row.viewer_id);
    }
  }
}

function accumulateLeadFunnelMetrics(args: {
  leads: Array<{ listing_id: string; tenant_id: string; source: string; created_at: string }>;
  inquiries: Array<{ property_id: string; tenant_id: string; created_at: string }>;
  viewings: Array<{ property_id: string; tenant_id: string; created_at: string }>;
  unlocks: Array<{ listing_id: string; user_id: string; unlocked_at: string }>;
  saves: Array<{ user_id: string; created_at: string }>;
  propertyLeadCount: Map<string, number>;
  propertyInquiryCount: Map<string, number>;
  propertyViewingCount: Map<string, number>;
  propertyUnlockCount: Map<string, number>;
  leadSourceCount: Map<string, number>;
  tenantLastActivity: Map<string, string>;
  tenantInquiryCount: Map<string, number>;
  tenantViewingCount: Map<string, number>;
  tenantUnlockCount: Map<string, number>;
  tenantSavedCount: Map<string, number>;
}) {
  for (const row of args.leads) {
    incrementCounter(args.propertyLeadCount, row.listing_id);
    incrementCounter(args.leadSourceCount, row.source);
    bumpLatest(args.tenantLastActivity, row.tenant_id, row.created_at);
  }
  for (const row of args.inquiries) {
    incrementCounter(args.propertyInquiryCount, row.property_id);
    incrementCounter(args.tenantInquiryCount, row.tenant_id);
    bumpLatest(args.tenantLastActivity, row.tenant_id, row.created_at);
  }
  for (const row of args.viewings) {
    incrementCounter(args.propertyViewingCount, row.property_id);
    incrementCounter(args.tenantViewingCount, row.tenant_id);
    bumpLatest(args.tenantLastActivity, row.tenant_id, row.created_at);
  }
  for (const row of args.unlocks) {
    incrementCounter(args.propertyUnlockCount, row.listing_id);
    incrementCounter(args.tenantUnlockCount, row.user_id);
    bumpLatest(args.tenantLastActivity, row.user_id, row.unlocked_at);
  }
  for (const row of args.saves) {
    incrementCounter(args.tenantSavedCount, row.user_id);
    bumpLatest(args.tenantLastActivity, row.user_id, row.created_at);
  }
}

function collectActiveNowSets(args: {
  propertyViewsNow: Array<{ viewer_id: string | null; session_id: string | null }>;
  searchEventsNow: Array<{ user_id: string | null; session_id: string | null }>;
  inquiries: Array<{ tenant_id: string; created_at: string }>;
  viewings: Array<{ tenant_id: string; created_at: string }>;
  unlocks: Array<{ user_id: string; unlocked_at: string }>;
  activeSince: string;
  tenantIdSet: Set<string>;
}) {
  const activeUserIds = new Set<string>();
  const activeTenantIds = new Set<string>();
  const activeSessionIds = new Set<string>();

  for (const row of args.propertyViewsNow) {
    markActiveActor(
      row.viewer_id,
      row.session_id,
      args.tenantIdSet,
      activeUserIds,
      activeTenantIds,
      activeSessionIds,
    );
  }
  for (const row of args.searchEventsNow) {
    markActiveActor(
      row.user_id,
      row.session_id,
      args.tenantIdSet,
      activeUserIds,
      activeTenantIds,
      activeSessionIds,
    );
  }
  markActiveIfRecent(
    args.inquiries.map((row) => ({ userId: row.tenant_id, at: row.created_at })),
    args.activeSince,
    args.tenantIdSet,
    activeUserIds,
    activeTenantIds,
  );
  markActiveIfRecent(
    args.viewings.map((row) => ({ userId: row.tenant_id, at: row.created_at })),
    args.activeSince,
    args.tenantIdSet,
    activeUserIds,
    activeTenantIds,
  );
  markActiveIfRecent(
    args.unlocks.map((row) => ({ userId: row.user_id, at: row.unlocked_at })),
    args.activeSince,
    args.tenantIdSet,
    activeUserIds,
    activeTenantIds,
  );

  return { activeUserIds, activeTenantIds, activeSessionIds };
}

function buildTenantAnalyticsAccounts(args: {
  tenantIds: string[];
  profileById: Map<
    string,
    {
      full_name: string | null;
      phone: string | null;
      tenant_plan: string | null;
      plus_expires_at: string | null;
    }
  >;
  tenantLastActivity: Map<string, string>;
  activeTenantIds: Set<string>;
  recentSince: string;
  tenantViewCount: Map<string, number>;
  tenantSavedCount: Map<string, number>;
  tenantUnlockCount: Map<string, number>;
  tenantInquiryCount: Map<string, number>;
  tenantViewingCount: Map<string, number>;
}) {
  return args.tenantIds
    .map((tenantId) => {
      const profile = args.profileById.get(tenantId);
      const lastActivityAt = args.tenantLastActivity.get(tenantId) ?? null;
      return {
        userId: tenantId,
        fullName: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        tenantPlan: profile?.tenant_plan ?? "free",
        plusExpiresAt: profile?.plus_expires_at ?? null,
        lastActivityAt,
        status: tenantStatusFromActivity(
          args.activeTenantIds.has(tenantId),
          lastActivityAt,
          args.recentSince,
        ),
        metrics: {
          propertyViews30d: args.tenantViewCount.get(tenantId) ?? 0,
          saves30d: args.tenantSavedCount.get(tenantId) ?? 0,
          contactUnlocks30d: args.tenantUnlockCount.get(tenantId) ?? 0,
          inquiries30d: args.tenantInquiryCount.get(tenantId) ?? 0,
          viewings30d: args.tenantViewingCount.get(tenantId) ?? 0,
        },
      };
    })
    .sort((a, b) => {
      const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return bTime - aTime;
    });
}

function buildPropertyTrafficRows(args: {
  properties: Array<{
    id: string;
    title: string;
    neighborhood: string;
    is_active: boolean;
    views: number | null;
    images: string[] | null;
    video_url: string | null;
    tour_url: string | null;
    contact_name: string | null;
    contact_phone?: string | null;
    contact_phones?: string[] | null;
  }>;
  propertyRecentViewCount: Map<string, number>;
  propertyRecentUniqueViewers: Map<string, Set<string>>;
  propertyLeadCount: Map<string, number>;
  propertyInquiryCount: Map<string, number>;
  propertyViewingCount: Map<string, number>;
  propertyUnlockCount: Map<string, number>;
}) {
  return args.properties
    .map((property) => {
      const phones = phonesFromProperty(property);
      const mediaCount =
        (property.images?.length ?? 0) + (property.video_url ? 1 : 0) + (property.tour_url ? 1 : 0);
      return {
        propertyId: property.id,
        title: property.title,
        neighborhood: property.neighborhood,
        isActive: property.is_active,
        lifetimeViews: property.views ?? 0,
        recentViews30d: args.propertyRecentViewCount.get(property.id) ?? 0,
        uniqueViewers30d: args.propertyRecentUniqueViewers.get(property.id)?.size ?? 0,
        leads30d: args.propertyLeadCount.get(property.id) ?? 0,
        inquiries30d: args.propertyInquiryCount.get(property.id) ?? 0,
        viewings30d: args.propertyViewingCount.get(property.id) ?? 0,
        contactUnlocks30d: args.propertyUnlockCount.get(property.id) ?? 0,
        mediaCount,
        hasDownloadableMedia: mediaCount > 0,
        contactName: property.contact_name?.trim() || null,
        contactPhones: phones,
      };
    })
    .sort((a, b) => {
      const scoreA = a.recentViews30d * 4 + a.leads30d * 8 + a.inquiries30d * 10 + a.viewings30d * 12;
      const scoreB = b.recentViews30d * 4 + b.leads30d * 8 + b.inquiries30d * 10 + b.viewings30d * 12;
      return scoreB - scoreA || b.lifetimeViews - a.lifetimeViews;
    });
}

function buildAreaTrafficRows(
  areaRecentViewCount: Map<string, number>,
  areaRecentUniqueViewers: Map<string, Set<string>>,
  properties: Array<{ neighborhood: string; is_active: boolean }>,
) {
  return [...areaRecentViewCount.entries()]
    .map(([neighborhood, recentViews30d]) => ({
      neighborhood,
      recentViews30d,
      uniqueViewers30d: areaRecentUniqueViewers.get(neighborhood)?.size ?? 0,
      activeListings: properties.filter(
        (property) => property.neighborhood === neighborhood && property.is_active,
      ).length,
    }))
    .sort((a, b) => b.recentViews30d - a.recentViews30d);
}

function applyPresenceLiveStatus<T extends { userId: string; status: string }>(
  tenantAccounts: T[],
  presenceUserIds: Set<string>,
) {
  if (presenceUserIds.size === 0) return;
  for (const tenant of tenantAccounts) {
    if (presenceUserIds.has(tenant.userId)) tenant.status = "live_now";
  }
}

export const listAdminVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");

    const { data: rows, error } = await supabase
      .from("verifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    const profileMap = await loadProfilesByIds([...new Set((rows ?? []).map((r) => r.user_id))]);
    return (rows ?? []).map((row) => ({
      ...row,
      profiles: profileMap.get(row.user_id) ?? null,
    }));
  });

export const updateVerificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("verifications")
      .update({ status: data.status, notes: data.notes ?? null })
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw error;

    const { data: userAuth } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    const email = userAuth.user?.email;
    const name =
      (userAuth.user?.user_metadata?.full_name as string | undefined) ??
      email?.split("@")[0] ??
      "there";

    if (email) {
      const { sendEmail } = await import("@/lib/email/send");
      const { verificationCompleteEmail } = await import("@/lib/email/templates");
      const { getSiteUrl } = await import("@/lib/site");
      const tpl = verificationCompleteEmail({
        name,
        propertyAddress: row.verification_type ?? "your property",
        passed: data.status === "approved",
        findings: data.notes ?? undefined,
        statusUrl: `${getSiteUrl()}/verify/status/${row.id}`,
      });
      void sendEmail({
        to: email,
        templateId: "verification-complete",
        ...tpl,
        metadata: { verificationId: row.id, status: data.status },
      });
    }

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: userId,
      action: `VERIFICATION_${data.status.toUpperCase()}`,
      target_id: data.id,
      details: `Updated verification status to ${data.status}. Notes: ${data.notes ?? ""}`,
    });

    return row;
  });

export const listAdminVerificationRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");

    const { data: rows, error } = await supabase
      .from("verification_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return rows ?? [];
  });

export const updateVerificationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
      report_url: z.string().url().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: {
      status?: string;
      report_url?: string | null;
    } = {};
    if (data.status) patch.status = data.status;
    if (data.report_url !== undefined) patch.report_url = data.report_url;

    const { data: row, error } = await supabaseAdmin
      .from("verification_requests")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw error;

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: userId,
      action: "VERIFICATION_REQUEST_UPDATED",
      target_id: data.id,
      details: `Updated verification request. status=${data.status ?? "unchanged"} report_url=${data.report_url ?? "unchanged"}`,
    });

    if (row.status === "completed" && row.report_url) {
      const { sendEmail } = await import("@/lib/email/send");
      const { getSiteUrl } = await import("@/lib/site");
      const { verificationCompleteEmail } = await import("@/lib/email/templates");
      const tpl = verificationCompleteEmail({
        name: row.requester_name,
        propertyAddress: row.property_address,
        passed: true,
        findings: "Your paid property verification report is ready to download.",
        statusUrl: `${getSiteUrl()}/verify/status/${row.id}`,
      });
      void sendEmail({
        to: row.requester_email,
        templateId: "verification-complete",
        ...tpl,
        metadata: { verificationRequestId: row.id, status: row.status },
      });
    }

    return row;
  });

export const listAdminScamReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabase
      .from("scam_reports")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) throw error;

    const propertyIds = [
      ...new Set((rows ?? []).map((r) => r.property_id).filter(Boolean)),
    ] as string[];
    const reporterIds = [
      ...new Set((rows ?? []).map((r) => r.reporter_id).filter(Boolean)),
    ] as string[];

    const [{ data: properties }, reporterMap] = await Promise.all([
      propertyIds.length
        ? supabaseAdmin
            .from("properties")
            .select("id, title, neighborhood, owner_id")
            .in("id", propertyIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              title: string;
              neighborhood: string;
              owner_id: string | null;
            }[],
          }),
      loadProfilesByIds(reporterIds),
    ]);

    const propertyMap = new Map((properties ?? []).map((p) => [p.id, p]));

    return (rows ?? []).map((row) => ({
      ...row,
      properties: propertyMap.get(row.property_id) ?? null,
      reporter: profileFromMap(row.reporter_id, reporterMap),
    }));
  });

export const updateScamReportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["reviewed", "dismissed"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("scam_reports")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw error;

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: userId,
      action: `SCAM_REPORT_${data.status.toUpperCase()}`,
      target_id: data.id,
      details: `Updated scam report status to ${data.status}.`,
    });

    return row;
  });

export const listAdminProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("properties")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    return mapPropertyRows(data ?? []);
  });

export const setAdminPropertyVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyId: z.string().uuid(),
      verified: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const verifiedAt = data.verified ? new Date().toISOString() : null;
    const { data: row, error } = await supabaseAdmin
      .from("properties")
      .update({
        is_verified: data.verified,
        nyumba_verified_at: verifiedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.propertyId)
      .select("id, title, is_verified, nyumba_verified_at")
      .single();

    if (error) throw error;

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: userId,
      action: data.verified ? "PROPERTY_VERIFIED" : "PROPERTY_UNVERIFIED",
      target_id: data.propertyId,
      details: `${data.verified ? "Verified" : "Unverified"} listing: ${row.title}`,
    });

    return row;
  });

export const adjustAdminPropertyAuthenticityScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        propertyId: z.string().uuid(),
        /** Relative adjust (−5 / +5 from admin UI). */
        delta: z.number().int().min(-100).max(100).optional(),
        /** Absolute set (e.g. admin “set to 100%”). */
        score: z.number().int().min(0).max(100).optional(),
      })
      .refine((data) => data.delta != null || data.score != null, {
        message: "Provide delta or score",
      }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current, error: fetchError } = await supabaseAdmin
      .from("properties")
      .select("id, title, authenticity_score")
      .eq("id", data.propertyId)
      .single();

    if (fetchError) throw fetchError;

    const previous = current.authenticity_score ?? 70;
    const next =
      data.score != null
        ? Math.max(0, Math.min(100, data.score))
        : Math.max(0, Math.min(100, previous + (data.delta ?? 0)));

    const { data: row, error } = await supabaseAdmin
      .from("properties")
      .update({
        authenticity_score: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.propertyId)
      .select("id, title, authenticity_score")
      .single();

    if (error) throw error;

    let changeNote = `set to ${next}%`;
    if (data.score == null) {
      const delta = data.delta ?? 0;
      const deltaLabel = delta >= 0 ? `+${delta}` : String(delta);
      changeNote = `${previous}% → ${next}% (${deltaLabel})`;
    }

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: userId,
      action: "PROPERTY_AUTHENTICITY_SCORE_ADJUSTED",
      target_id: data.propertyId,
      details: `Authenticity score ${changeNote} on ${row.title}`,
    });

    return row;
  });

export const listAdminAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");

    const { data: rows, error } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    const adminIds = [...new Set((rows ?? []).map((r) => r.admin_id).filter(Boolean))] as string[];
    const profileMap = await loadProfilesByIds(adminIds);
    return (rows ?? []).map((row) => ({
      ...row,
      admin: profileFromMap(row.admin_id, profileMap),
    }));
  });

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(5000),
  ctaLabel: z.string().trim().min(2).max(80),
  ctaUrl: z.string().trim().url().max(500),
  targetRoles: z
    .array(z.enum(["tenant", "landlord", "agency", "manager", "all"]))
    .min(1)
    .max(5),
});

export const sendAdminAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(announcementSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendProductAnnouncement } = await import("@/lib/cron/announcements");
    return sendProductAnnouncement(supabaseAdmin, data, userId);
  });

const listingAccountRoleSchema = z.enum(["landlord", "agency", "manager"]);
type ListingAccountRole = z.infer<typeof listingAccountRoleSchema>;

function primaryPortalRole(roles: Set<ListingAccountRole>): ListingAccountRole {
  if (roles.has("agency")) return "agency";
  if (roles.has("manager")) return "manager";
  return "landlord";
}

async function searchListingAccountUserIds(
  supabaseAdmin: SupabaseClient,
  query: string,
): Promise<string[]> {
  const matched = new Set<string>();
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(60);
  for (const profile of profiles ?? []) matched.add(profile.id);

  const { data: orgs } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .ilike("name", `%${query}%`)
    .limit(30);
  const orgIds = (orgs ?? []).map((org) => org.id);
  if (orgIds.length > 0) {
    const { data: members } = await supabaseAdmin
      .from("organization_members")
      .select("user_id")
      .in("organization_id", orgIds);
    for (const member of members ?? []) matched.add(member.user_id);
  }

  return [...matched];
}

function rolesByUserFromRows(
  roleRows: Array<{ user_id: string; role: string }> | null,
): Map<string, Set<ListingAccountRole>> {
  const rolesByUser = new Map<string, Set<ListingAccountRole>>();
  for (const row of roleRows ?? []) {
    if (!listingAccountRoleSchema.safeParse(row.role).success) continue;
    const role = row.role as ListingAccountRole;
    const set = rolesByUser.get(row.user_id) ?? new Set<ListingAccountRole>();
    set.add(role);
    rolesByUser.set(row.user_id, set);
  }
  return rolesByUser;
}

function activeListingCounts(rows: Array<{ owner_id: string | null }> | null): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    if (!row.owner_id) continue;
    counts.set(row.owner_id, (counts.get(row.owner_id) ?? 0) + 1);
  }
  return counts;
}

export const listAdminListingAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      query: z.string().trim().optional(),
      role: listingAccountRoleSchema.optional(),
      limit: z.number().int().min(1).max(50).default(25),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rolesFilter: ListingAccountRole[] = data.role
      ? [data.role]
      : ["landlord", "agency", "manager"];

    const q = data.query?.trim();
    let candidateUserIds: string[] | null = null;
    if (q) {
      candidateUserIds = await searchListingAccountUserIds(supabaseAdmin, q);
      if (candidateUserIds.length === 0) return [];
    }

    let roleQuery = supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", rolesFilter);
    if (candidateUserIds) {
      roleQuery = roleQuery.in("user_id", candidateUserIds.slice(0, 100));
    }
    const { data: roleRows, error: roleError } = await roleQuery;
    if (roleError) throw roleError;

    const rolesByUser = rolesByUserFromRows(roleRows);
    const userIds = [...rolesByUser.keys()].slice(0, data.limit);
    if (userIds.length === 0) return [];

    const [{ data: memberships }, { data: activeRows }, profileMap, capProfileMap] =
      await Promise.all([
        supabaseAdmin
          .from("organization_members")
          .select("user_id, organizations(name, type)")
          .in("user_id", userIds),
        supabaseAdmin
          .from("properties")
          .select("owner_id")
          .in("owner_id", userIds)
          .eq("is_active", true),
        loadProfilesByIds(userIds),
        loadListingCapProfilesByIds(userIds),
      ]);

    const plans = await Promise.all(
      userIds.map(async (id) => ({
        userId: id,
        plan: await getActiveLandlordPlan(supabaseAdmin, id),
      })),
    );
    const planByUser = new Map(plans.map((entry) => [entry.userId, entry.plan]));

    const orgByUser = new Map<string, { name: string; type: string }>();
    for (const row of memberships ?? []) {
      const org = row.organizations as { name: string; type: string } | null;
      if (org) orgByUser.set(row.user_id, org);
    }

    const activeCountByUser = activeListingCounts(activeRows);

    return userIds
      .map((id) => {
        const roleSet = rolesByUser.get(id) ?? new Set<ListingAccountRole>();
        const profile = profileMap.get(id);
        const org = orgByUser.get(id);
        const capProfile = capProfileMap.get(id);
        const plan = planByUser.get(id) ?? "free";
        const planLimit = baseListingCap(plan);
        const bonusListingSlots = capProfile?.bonus_listing_slots ?? 0;
        const adminListingLimitOverride = capProfile?.admin_listing_limit_override ?? null;
        const listingLimit = resolveListingCap({
          plan,
          bonusSlots: bonusListingSlots,
          adminOverride: adminListingLimitOverride,
        });
        return {
          userId: id,
          fullName: profile?.full_name ?? null,
          phone: profile?.phone ?? null,
          roles: [...roleSet],
          portalRole: primaryPortalRole(roleSet),
          organizationName: org?.name ?? null,
          organizationType: org?.type ?? null,
          activeListings: activeCountByUser.get(id) ?? 0,
          plan,
          planLimit,
          bonusListingSlots,
          adminListingLimitOverride,
          listingLimit,
        };
      })
      .sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? ""));
  });

export const adjustAdminListingLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      delta: z.number().int().min(-9999).max(9999),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId: adminId } = getAuthContext(context);
    await requireRole(supabase, adminId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertListingAccountUser(supabaseAdmin, data.userId);

    const current = await getListingCap(supabaseAdmin, data.userId);
    const next = Math.max(0, Math.min(9999, current + data.delta));

    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .update({
        admin_listing_limit_override: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.userId)
      .select("id, full_name, admin_listing_limit_override")
      .single();

    if (error) throw error;

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: adminId,
      action: "LISTING_LIMIT_ADJUSTED",
      target_id: data.userId,
      details: `Listing limit ${current} → ${next} (${data.delta >= 0 ? "+" : ""}${data.delta}) for ${row.full_name ?? data.userId}`,
    });

    return {
      userId: row.id,
      listingLimit: row.admin_listing_limit_override ?? next,
      adminListingLimitOverride: row.admin_listing_limit_override,
    };
  });

export const resetAdminListingLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId: adminId } = getAuthContext(context);
    await requireRole(supabase, adminId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertListingAccountUser(supabaseAdmin, data.userId);

    const previous = await getListingCap(supabaseAdmin, data.userId);

    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .update({
        admin_listing_limit_override: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.userId)
      .select("id, full_name")
      .single();

    if (error) throw error;

    const restored = await getListingCap(supabaseAdmin, data.userId);

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: adminId,
      action: "LISTING_LIMIT_RESET",
      target_id: data.userId,
      details: `Listing limit reset ${previous} → ${restored} (plan default) for ${row.full_name ?? data.userId}`,
    });

    return {
      userId: data.userId,
      fullName: row.full_name,
      listingLimit: restored,
      adminListingLimitOverride: null,
    };
  });

export const setAdminPropertyActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyId: z.string().uuid(),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("properties")
      .update({
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.propertyId)
      .select("id, title, is_active")
      .single();
    if (error) throw error;

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: userId,
      action: data.isActive ? "PROPERTY_REACTIVATED" : "PROPERTY_SOFT_DELETED",
      target_id: data.propertyId,
      details: `${data.isActive ? "Reactivated" : "Soft-deleted"} listing: ${row.title}`,
    });

    try {
      const { invalidateListingCaches } = await import("@/lib/cache/manager");
      await invalidateListingCaches();
    } catch {
      // best-effort cache bust
    }

    return row;
  });

export const getAdminPropertyMediaDownloads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const helpers = await import("@/lib/media/property-media-path");

    const { data: property, error } = await supabaseAdmin
      .from("properties")
      .select("id, title, images, video_url, tour_url")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (error) throw error;
    if (!property) throw new Error("Listing not found");

    const items: AdminMediaItem[] = [];
    const pathsToSign: string[] = [];
    collectImageMediaItems(property.images, helpers, items, pathsToSign);
    collectLinkedMediaItems(
      [
        ["video", property.video_url],
        ["tour", property.tour_url],
      ],
      helpers,
      items,
      pathsToSign,
    );

    const signedByPath = await signPropertyMediaPaths(supabaseAdmin, pathsToSign);

    return {
      propertyId: property.id,
      title: property.title,
      items: items.map((item) => ({
        kind: item.kind,
        filename: item.filename,
        url: (item.path && signedByPath.get(item.path)) || item.url,
      })),
    };
  });

export const getAdminPlatformAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const activeWindowMinutes = 15;
    const recentWindowDays = 30;
    const chartWindowDays = 7;
    const activeSince = isoMinutesAgo(activeWindowMinutes);
    const recentSince = isoDaysAgo(recentWindowDays);
    const chartSince = isoDaysAgo(chartWindowDays - 1);

    const [
      profilesCountRes,
      propertiesCountRes,
      activePropertiesCountRes,
      leadsCountRes,
      inquiriesCountRes,
      viewingsCountRes,
      contactUnlocksCountRes,
      tenantRoleRowsRes,
      listingRoleRowsRes,
      tenantProfilesRes,
      propertyRowsRes,
      leadRowsRes,
      inquiryRowsRes,
      viewingRowsRes,
      contactUnlockRowsRes,
      savedRowsRes,
      propertyViewsRecentRes,
      propertyViewsChartRes,
      propertyViewsNowRes,
      searchEventsNowRes,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("properties").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("properties").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin.from("leads").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("viewings").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("contact_unlocks").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("user_roles").select("user_id, role").eq("role", "tenant"),
      supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["landlord", "agency", "manager"]),
      supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, phone, tenant_plan, plus_expires_at, created_at, updated_at, is_portal_active, active_portal",
        ),
      supabaseAdmin
        .from("properties")
        .select(
          "id, title, neighborhood, owner_id, contact_name, contact_phone, contact_phones, images, video_url, tour_url, views, is_active",
        )
        .order("views", { ascending: false }),
      supabaseAdmin
        .from("leads")
        .select("listing_id, tenant_id, source, created_at")
        .gte("created_at", recentSince),
      supabaseAdmin
        .from("inquiries")
        .select("property_id, tenant_id, created_at")
        .gte("created_at", recentSince),
      supabaseAdmin
        .from("viewings")
        .select("property_id, tenant_id, status, created_at")
        .gte("created_at", recentSince),
      supabaseAdmin
        .from("contact_unlocks")
        .select("listing_id, user_id, method, unlocked_at")
        .gte("unlocked_at", recentSince),
      supabaseAdmin
        .from("saved_properties")
        .select("property_id, user_id, created_at")
        .gte("created_at", recentSince),
      supabaseAdmin
        .from("property_views")
        .select("property_id, viewer_id, session_id, created_at")
        .gte("created_at", recentSince),
      supabaseAdmin
        .from("property_views")
        .select("property_id, viewer_id, created_at")
        .gte("created_at", chartSince),
      supabaseAdmin
        .from("property_views")
        .select("viewer_id, session_id, created_at")
        .gte("created_at", activeSince),
      supabaseAdmin
        .from("search_events")
        .select("user_id, session_id, created_at")
        .gte("created_at", activeSince),
    ]);

    throwQueryErrors([
      tenantRoleRowsRes,
      listingRoleRowsRes,
      tenantProfilesRes,
      propertyRowsRes,
      leadRowsRes,
      inquiryRowsRes,
      viewingRowsRes,
      contactUnlockRowsRes,
      savedRowsRes,
      propertyViewsRecentRes,
      propertyViewsChartRes,
      propertyViewsNowRes,
      searchEventsNowRes,
    ]);

    const tenantIds = [...new Set((tenantRoleRowsRes.data ?? []).map((row) => row.user_id))];
    const listingAccountIds = [...new Set((listingRoleRowsRes.data ?? []).map((row) => row.user_id))];
    const tenantIdSet = new Set(tenantIds);
    const listingAccountIdSet = new Set(listingAccountIds);

    const profileById = new Map((tenantProfilesRes.data ?? []).map((row) => [row.id, row]));
    const propertyById = new Map((propertyRowsRes.data ?? []).map((row) => [row.id, row]));

    const tenantLastActivity = new Map<string, string>();
    const tenantViewCount = new Map<string, number>();
    const tenantSavedCount = new Map<string, number>();
    const tenantUnlockCount = new Map<string, number>();
    const tenantInquiryCount = new Map<string, number>();
    const tenantViewingCount = new Map<string, number>();

    const propertyLeadCount = new Map<string, number>();
    const propertyInquiryCount = new Map<string, number>();
    const propertyViewingCount = new Map<string, number>();
    const propertyUnlockCount = new Map<string, number>();
    const propertyRecentViewCount = new Map<string, number>();
    const propertyRecentUniqueViewers = new Map<string, Set<string>>();
    const areaRecentViewCount = new Map<string, number>();
    const areaRecentUniqueViewers = new Map<string, Set<string>>();
    const leadSourceCount = new Map<string, number>();

    accumulatePropertyViewMetrics({
      views: propertyViewsRecentRes.data ?? [],
      propertyById,
      propertyRecentViewCount,
      propertyRecentUniqueViewers,
      areaRecentViewCount,
      areaRecentUniqueViewers,
      tenantLastActivity,
      tenantViewCount,
    });

    accumulateLeadFunnelMetrics({
      leads: leadRowsRes.data ?? [],
      inquiries: inquiryRowsRes.data ?? [],
      viewings: viewingRowsRes.data ?? [],
      unlocks: contactUnlockRowsRes.data ?? [],
      saves: savedRowsRes.data ?? [],
      propertyLeadCount,
      propertyInquiryCount,
      propertyViewingCount,
      propertyUnlockCount,
      leadSourceCount,
      tenantLastActivity,
      tenantInquiryCount,
      tenantViewingCount,
      tenantUnlockCount,
      tenantSavedCount,
    });

    const { activeUserIds, activeTenantIds, activeSessionIds } = collectActiveNowSets({
      propertyViewsNow: propertyViewsNowRes.data ?? [],
      searchEventsNow: searchEventsNowRes.data ?? [],
      inquiries: inquiryRowsRes.data ?? [],
      viewings: viewingRowsRes.data ?? [],
      unlocks: contactUnlockRowsRes.data ?? [],
      activeSince,
      tenantIdSet,
    });

    const tenantAccounts = buildTenantAnalyticsAccounts({
      tenantIds,
      profileById,
      tenantLastActivity,
      activeTenantIds,
      recentSince,
      tenantViewCount,
      tenantSavedCount,
      tenantUnlockCount,
      tenantInquiryCount,
      tenantViewingCount,
    });

    const propertyTraffic = buildPropertyTrafficRows({
      properties: propertyRowsRes.data ?? [],
      propertyRecentViewCount,
      propertyRecentUniqueViewers,
      propertyLeadCount,
      propertyInquiryCount,
      propertyViewingCount,
      propertyUnlockCount,
    });

    const areaTraffic = buildAreaTrafficRows(
      areaRecentViewCount,
      areaRecentUniqueViewers,
      propertyRowsRes.data ?? [],
    );

    const activityChart7d = buildActivityChartBuckets(
      chartWindowDays,
      propertyViewsChartRes.data ?? [],
      leadRowsRes.data ?? [],
      inquiryRowsRes.data ?? [],
      viewingRowsRes.data ?? [],
    );

    const listingProfileRows = (tenantProfilesRes.data ?? []).filter((profile) =>
      listingAccountIdSet.has(profile.id),
    );
    const mediaReadyListings = (propertyRowsRes.data ?? []).filter(
      (property) =>
        (property.images?.length ?? 0) > 0 || Boolean(property.video_url) || Boolean(property.tour_url),
    ).length;

    const presence = await fetchPresenceSnapshot();
    const presenceLiveUserIds = new Set(
      (presence?.sessions ?? []).map((session) => session.userId).filter(Boolean) as string[],
    );
    applyPresenceLiveStatus(tenantAccounts, presenceLiveUserIds);

    const usingRealtimePresence = Boolean(presence && presence.totalConnections > 0);

    return {
      generatedAt: new Date().toISOString(),
      definitions: {
        activeNow: usingRealtimePresence
          ? "Live WebSocket connections (real-time presence)"
          : `Signed-in activity in the last ${activeWindowMinutes} minutes`,
        recentWindow: `Last ${recentWindowDays} days`,
      },
      presenceRealtime: presence,
      totals: {
        totalUsers: profilesCountRes.count ?? 0,
        totalTenantAccounts: tenantIds.length,
        totalListingAccounts: listingAccountIds.length,
        activeUsersNow: presence?.uniqueUsers ?? activeUserIds.size,
        activeTenantsNow: presence?.uniqueTenants ?? activeTenantIds.size,
        activeSessionsNow: presence?.totalConnections ?? activeSessionIds.size,
        activePortalAccounts: listingProfileRows.filter((profile) => profile.is_portal_active).length,
        inactivePortalAccounts: listingProfileRows.filter((profile) => !profile.is_portal_active).length,
        totalListings: propertiesCountRes.count ?? 0,
        activeListings: activePropertiesCountRes.count ?? 0,
        inactiveListings: Math.max(
          0,
          (propertiesCountRes.count ?? 0) - (activePropertiesCountRes.count ?? 0),
        ),
        totalLeads: leadsCountRes.count ?? 0,
        totalInquiries: inquiriesCountRes.count ?? 0,
        totalViewings: viewingsCountRes.count ?? 0,
        totalContactUnlocks: contactUnlocksCountRes.count ?? 0,
        mediaReadyListings,
      },
      leadSources30d: [...leadSourceCount.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      activityChart7d,
      areaTraffic,
      propertyTraffic,
      tenantAccounts,
    };
  });
