import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { getAuthContext } from "@/lib/api/server-context";
import { normalizeLocationName } from "@/lib/locations/normalize";

export const getAdminLocationOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const db = asLooseDb(supabaseAdmin);

    const types = ["COUNTY", "CONSTITUENCY", "WARD", "LOCALITY", "NEIGHBOURHOOD", "ROAD"] as const;
    const counts: Record<string, number> = {};
    await Promise.all(
      types.map(async (t) => {
        const { count } = await db
          .from("locations")
          .select("id", { count: "exact", head: true })
          .eq("location_type", t)
          .eq("is_active", true);
        counts[t] = count ?? 0;
      }),
    );

    const { count: needsReview } = await db
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("location_needs_review", true);

    const { count: unmatched } = await db
      .from("properties")
      .select("id", { count: "exact", head: true })
      .is("location_id", null)
      .not("neighborhood", "is", null);

    const { data: recentAudit } = await db
      .from("location_audit_events")
      .select("id,location_id,action,details,created_at,actor_id")
      .order("created_at", { ascending: false })
      .limit(25);

    const { loadLocationDemand } = await import("@/lib/locations/demand");
    const demand = await loadLocationDemand(db, { days: 30, limit: 40 });

    const { data: topSearches } = await db
      .from("location_search_events")
      .select("normalized_query,result_count,created_at")
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(500);

    const searchAgg = new Map<string, number>();
    for (const row of topSearches ?? []) {
      const q = String(row.normalized_query ?? "").trim();
      if (!q) continue;
      searchAgg.set(q, (searchAgg.get(q) ?? 0) + 1);
    }
    const popularQueries = [...searchAgg.entries()]
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      counts,
      needsReview: needsReview ?? 0,
      unmatched: unmatched ?? 0,
      recentAudit: recentAudit ?? [],
      demand,
      popularQueries,
    };
  });

export const listAdminLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      q: z.string().max(80).optional(),
      type: z.string().max(40).optional(),
      needsReviewOnly: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const db = asLooseDb(supabaseAdmin);
    const limit = data.limit ?? 50;

    let q = db
      .from("locations")
      .select(
        "id,name,slug,location_type,parent_id,inventory_count,confidence_score,is_official,is_active,source,normalized_name",
      )
      .order("inventory_count", { ascending: false })
      .limit(limit);

    if (data.type) q = q.eq("location_type", data.type);
    if (data.q?.trim()) {
      const n = normalizeLocationName(data.q);
      q = q.ilike("normalized_name", `%${n}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw error;

    const ids = (rows ?? []).map((r) => r.id as string);
    const { data: aliases } = ids.length
      ? await db.from("location_aliases").select("location_id,alias,alias_kind").in("location_id", ids)
      : { data: [] as Array<{ location_id: string; alias: string; alias_kind: string }> };

    const aliasMap = new Map<string, Array<{ alias: string; kind: string }>>();
    for (const a of aliases ?? []) {
      const list = aliasMap.get(a.location_id) ?? [];
      list.push({ alias: a.alias, kind: a.alias_kind });
      aliasMap.set(a.location_id, list);
    }

    return (rows ?? []).map((r) => ({
      ...r,
      aliases: aliasMap.get(r.id as string) ?? [],
    }));
  });

export const addAdminLocationAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      locationId: z.string().uuid(),
      alias: z.string().trim().min(2).max(120),
      kind: z
        .enum([
          "official",
          "common",
          "spelling",
          "abbreviation",
          "former",
          "colloquial",
          "swahili",
          "search",
          "typo",
        ])
        .optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const db = asLooseDb(supabaseAdmin);
    const normalized = normalizeLocationName(data.alias);
    const { error } = await db.from("location_aliases").upsert(
      {
        location_id: data.locationId,
        alias: data.alias.trim(),
        normalized_alias: normalized,
        alias_kind: data.kind ?? "common",
      },
      { onConflict: "location_id,normalized_alias" },
    );
    if (error) throw error;
    await db.from("location_audit_events").insert({
      location_id: data.locationId,
      actor_id: userId,
      action: "alias_add",
      details: { alias: data.alias, kind: data.kind ?? "common" },
    });
    return { ok: true };
  });

export const removeAdminLocationAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      locationId: z.string().uuid(),
      alias: z.string().trim().min(1).max(120),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const db = asLooseDb(supabaseAdmin);
    const normalized = normalizeLocationName(data.alias);
    const { error } = await db
      .from("location_aliases")
      .delete()
      .eq("location_id", data.locationId)
      .eq("normalized_alias", normalized);
    if (error) throw error;
    await db.from("location_audit_events").insert({
      location_id: data.locationId,
      actor_id: userId,
      action: "alias_remove",
      details: { alias: data.alias },
    });
    return { ok: true };
  });

export const setAdminLocationActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      locationId: z.string().uuid(),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const db = asLooseDb(supabaseAdmin);
    const { error } = await db
      .from("locations")
      .update({ is_active: data.isActive, updated_at: new Date().toISOString() })
      .eq("id", data.locationId);
    if (error) throw error;
    await db.from("location_audit_events").insert({
      location_id: data.locationId,
      actor_id: userId,
      action: data.isActive ? "activate" : "deactivate",
      details: {},
    });
    return { ok: true };
  });
