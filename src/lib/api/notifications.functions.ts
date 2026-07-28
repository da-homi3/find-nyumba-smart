import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { adminClient } from "@/lib/api/nyumba/nyumba-shared";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/lib/notifications/types";
import { getOrCreateNotificationPreferences } from "@/lib/notifications/notify-user";

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      limit: z.number().int().min(1).max(50).optional(),
      unreadOnly: z.boolean().optional(),
      before: z.string().datetime().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const limit = data.limit ?? 30;
    const admin = await adminClient();

    let q = admin
      .from("notifications")
      .select("id, type, title, body, href, entity_type, entity_id, read_at, created_at, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (data.unreadOnly) q = q.is("read_at", null);
    if (data.before) q = q.lt("created_at", data.before);

    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      type: r.type as string,
      title: r.title as string,
      body: r.body as string,
      href: (r.href as string | null) ?? null,
      entityType: (r.entity_type as string | null) ?? null,
      entityId: (r.entity_id as string | null) ?? null,
      readAt: (r.read_at as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  });

export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const admin = await adminClient();
    const { count, error } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return { count: count ?? 0 };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { userId, supabase } = getAuthContext(context);
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return { success: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = getAuthContext(context);
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return { success: true };
  });

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const admin = await adminClient();
    return getOrCreateNotificationPreferences(admin, userId);
  });

const prefsSchema = z.object({
  announcements: z.boolean().optional(),
  listings: z.boolean().optional(),
  messages: z.boolean().optional(),
  maintenance: z.boolean().optional(),
  payments: z.boolean().optional(),
  account: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
});

export const updateNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(prefsSchema)
  .handler(async ({ context, data }) => {
    const { userId, supabase } = getAuthContext(context);
    await getOrCreateNotificationPreferences(await adminClient(), userId);

    const patch: Partial<NotificationPreferences> & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFERENCES) as Array<
      keyof NotificationPreferences
    >) {
      if (typeof data[key] === "boolean") patch[key] = data[key];
    }

    const { data: row, error } = await supabase
      .from("notification_preferences")
      .update(patch)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return {
      announcements: row.announcements,
      listings: row.listings,
      messages: row.messages,
      maintenance: row.maintenance,
      payments: row.payments,
      account: row.account,
      push_enabled: row.push_enabled,
    } satisfies NotificationPreferences;
  });

export { registerPushToken } from "@/lib/api/search.functions";
