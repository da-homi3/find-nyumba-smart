import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Json = Database["public"]["Tables"]["saved_searches"]["Insert"]["criteria"];

const savedSearchSchema = z.object({
  name: z.string().trim().min(1).max(100),
  filters: z.record(z.unknown()).default({}),
  alertEnabled: z.boolean().default(true),
});

function getContext(context: unknown) {
  const c = context as { supabase: SupabaseClient<Database>; userId: string };
  if (!c?.supabase || !c?.userId) throw new Error("Unauthorized");
  return c;
}

export const createSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(savedSearchSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getContext(context);
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
    const { supabase, userId } = getContext(context);
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
    const { supabase, userId } = getContext(context);
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
    const { supabase, userId } = getContext(context);
    const patch: Record<string, unknown> = {};
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
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).min(2).max(4) }))
  .handler(async ({ data }) => {
    const { createPublicClient, PUBLIC_PROPERTY_COLUMNS } = await import("@/lib/api/public-client");
    const supabase = createPublicClient();
    const { data: rows, error } = await supabase
      .from("properties")
      .select(PUBLIC_PROPERTY_COLUMNS)
      .in("id", data.ids)
      .eq("is_active", true);
    if (error) throw error;
    return rows ?? [];
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
    const { supabase, userId } = getContext(context);
    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        { user_id: userId, token: data.token, platform: data.platform },
        { onConflict: "user_id,token" },
      );
    if (error) throw error;
    return { registered: true };
  });
