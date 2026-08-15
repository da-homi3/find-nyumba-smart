import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import type { Database } from "@/integrations/supabase/types";

type Json = Database["public"]["Tables"]["saved_searches"]["Insert"]["criteria"];

const savedSearchSchema = z.object({
  name: z.string().trim().min(1).max(100),
  filters: z.record(z.unknown()).default({}),
  alertEnabled: z.boolean().default(true),
});

export const createSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(savedSearchSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);

    const { getTenantPlusStatus } = await import("@/lib/revenue/subscription-store");
    const plus = await getTenantPlusStatus(supabase, userId);
    const isPlus = plus.tenantPlan === "plus";
    const { maxSavedSearchAlerts } = await import("@/lib/revenue/tenant-plus-config");

    if (data.alertEnabled && !isPlus) {
      const cap = maxSavedSearchAlerts(false);
      const { count } = await supabase
        .from("saved_searches")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("alert_enabled", true);
      if ((count ?? 0) >= cap) {
        throw new Error(
          `Free plan allows ${cap} search alert. Upgrade to Tenant Plus for unlimited alerts.`,
        );
      }
    }

    const { data: row, error } = await supabase
      .from("saved_searches")
      .insert({
        user_id: userId,
        name: data.name,
        filters: data.filters as Json,
        criteria: data.filters as Json,
        alert_enabled: data.alertEnabled,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const listSavedSearches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    const { data, error } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const deleteSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    const { error } = await supabase
      .from("saved_searches")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { deleted: true };
  });

export const updateSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      alertEnabled: z.boolean().optional(),
      name: z.string().trim().min(1).max(100).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    const patch: Database["public"]["Tables"]["saved_searches"]["Update"] = {};
    if (data.alertEnabled !== undefined) patch.alert_enabled = data.alertEnabled;
    if (data.name !== undefined) patch.name = data.name;
    const { data: row, error } = await supabase
      .from("saved_searches")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const compareProperties = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).min(2).max(8) }))
  .handler(async ({ data }) => {
    const { TENANT_PLUS_CONFIG, maxComparedProperties } = await import(
      "@/lib/revenue/tenant-plus-config"
    );
    let isPlus = false;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const header = req?.headers?.get("authorization");
      const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
      if (bearer) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: auth } = await supabaseAdmin.auth.getUser(bearer);
        if (auth.user) {
          const { getTenantPlusStatus } = await import("@/lib/revenue/subscription-store");
          const plus = await getTenantPlusStatus(supabaseAdmin, auth.user.id);
          isPlus = plus.tenantPlan === "plus";
        }
      }
    } catch {
      isPlus = false;
    }

    const unique = [...new Set(data.ids)];
    const cap = maxComparedProperties(isPlus);
    if (unique.length > cap) {
      throw new Error(
        isPlus
          ? `You can compare up to ${cap} homes at once.`
          : `Free plan compares up to ${TENANT_PLUS_CONFIG.freeCompareLimit} homes. Upgrade to Tenant Plus to compare more.`,
      );
    }

    const { createPublicClient, PROPERTY_DETAIL_COLUMNS } = await import("@/lib/api/public-client");
    const { mapPropertyRows } = await import("@/lib/api/nyumba/nyumba-shared");
    const supabase = createPublicClient();
    const { data: rows, error } = await supabase
      .from("properties")
      .select(PROPERTY_DETAIL_COLUMNS)
      .in("id", unique)
      .eq("is_active", true);
    if (error) throw error;
    return mapPropertyRows(rows ?? []);
  });

export const setSavedSearchAlertsEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ enabled: z.boolean() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    if (data.enabled) {
      const { getTenantPlusStatus } = await import("@/lib/revenue/subscription-store");
      const { maxSavedSearchAlerts } = await import("@/lib/revenue/tenant-plus-config");
      const plus = await getTenantPlusStatus(supabase, userId);
      if (plus.tenantPlan !== "plus") {
        const cap = maxSavedSearchAlerts(false);
        const { data: rows } = await supabase
          .from("saved_searches")
          .select("id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        const ids = (rows ?? []).map((r) => r.id);
        const keep = ids.slice(0, cap);
        const rest = ids.slice(cap);
        if (keep.length) {
          await supabase
            .from("saved_searches")
            .update({ alert_enabled: true })
            .eq("user_id", userId)
            .in("id", keep);
        }
        if (rest.length) {
          await supabase
            .from("saved_searches")
            .update({ alert_enabled: false })
            .eq("user_id", userId)
            .in("id", rest);
        }
        return { enabled: true, limited: true, kept: keep.length };
      }
    }
    const { error } = await supabase
      .from("saved_searches")
      .update({ alert_enabled: data.enabled })
      .eq("user_id", userId);
    if (error) throw error;
    return { enabled: data.enabled };
  });

export const registerPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      token: z.string().min(1),
      platform: z.enum(["ios", "android", "web"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        { user_id: userId, token: data.token, platform: data.platform },
        { onConflict: "user_id,token" },
      );
    if (error) throw error;
    return { registered: true };
  });
