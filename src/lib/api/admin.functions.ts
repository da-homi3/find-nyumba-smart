import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { getAuthContext, profileFromMap } from "@/lib/api/server-context";
import { mapPropertyRows } from "@/lib/api/nyumba/nyumba-shared";
import { baseListingCap, getListingCap, resolveListingCap } from "@/lib/promo/listing-cap";
import { getActiveLandlordPlan } from "@/lib/revenue/subscription-store";

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
    z.object({
      propertyId: z.string().uuid(),
      delta: z.number().int().min(-100).max(100),
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
    const next = Math.max(0, Math.min(100, previous + data.delta));

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

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: userId,
      action: "PROPERTY_AUTHENTICITY_SCORE_ADJUSTED",
      target_id: data.propertyId,
      details: `Authenticity score ${previous}% → ${next}% (${data.delta >= 0 ? "+" : ""}${data.delta}) on ${row.title}`,
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
      userId: row.id,
      listingLimit: restored,
      adminListingLimitOverride: null as number | null,
    };
  });
