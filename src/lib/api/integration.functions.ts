import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { getAuthContext } from "@/lib/api/server-context";
import { hashApiKey } from "@/lib/api/v1/router";

export const createIntegrationApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ name: z.string().trim().min(2).max(80) }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency", "admin"]);

    const raw = `nsk_${crypto.randomUUID().replace(/-/g, "")}`;
    const keyHash = await hashApiKey(raw);
    const prefix = raw.slice(0, 12);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("integration_api_keys")
      .insert({
        user_id: userId,
        name: data.name,
        key_prefix: prefix,
        key_hash: keyHash,
        scope: "listings",
      })
      .select("id, name, key_prefix, created_at")
      .single();

    if (error) throw error;
    return { ...row, apiKey: raw };
  });

export const listIntegrationApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("integration_api_keys")
      .select("id, name, key_prefix, created_at, revoked_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const revokeIntegrationApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ keyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integration_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.keyId)
      .eq("user_id", userId);
    if (error) throw error;
    return { revoked: true };
  });
