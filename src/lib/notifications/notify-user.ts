import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  TYPE_TO_CATEGORY,
  type NotificationPreferences,
  type NotificationType,
  type NotifyPayload,
} from "@/lib/notifications/types";

type Admin = SupabaseClient<Database>;

export async function getOrCreateNotificationPreferences(
  admin: Admin,
  userId: string,
): Promise<NotificationPreferences> {
  const { data } = await admin
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) {
    return {
      announcements: data.announcements,
      listings: data.listings,
      messages: data.messages,
      maintenance: data.maintenance,
      payments: data.payments,
      account: data.account,
      push_enabled: data.push_enabled,
    };
  }

  const { error } = await admin.from("notification_preferences").insert({
    user_id: userId,
    ...DEFAULT_NOTIFICATION_PREFERENCES,
  });
  if (error && error.code !== "23505") {
    console.warn("[notifications] prefs seed failed", error.message);
  }
  return { ...DEFAULT_NOTIFICATION_PREFERENCES };
}

export function categoryEnabled(
  prefs: NotificationPreferences,
  type: NotificationType,
): boolean {
  const category = TYPE_TO_CATEGORY[type];
  return prefs[category] !== false;
}

/** Insert in-app notification + optional push. Does not send email. */
export async function notifyUser(
  admin: Admin,
  payload: NotifyPayload,
): Promise<{ id: string | null; skipped: boolean }> {
  const prefs = await getOrCreateNotificationPreferences(admin, payload.userId);
  if (!categoryEnabled(prefs, payload.type)) {
    return { id: null, skipped: true };
  }

  const title = payload.title.trim().slice(0, 200);
  const body = payload.body.trim().slice(0, 2000);
  if (!title) return { id: null, skipped: true };

  const { data, error } = await admin
    .from("notifications")
    .insert({
      user_id: payload.userId,
      type: payload.type,
      title,
      body,
      href: payload.href ?? null,
      entity_type: payload.entityType ?? null,
      entity_id: payload.entityId ?? null,
      metadata: payload.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[notifications] insert failed", error.message);
    return { id: null, skipped: false };
  }

  const notificationId = data.id as string;

  if (prefs.push_enabled) {
    const { sendPushToUser } = await import("@/lib/notifications/push-send");
    sendPushToUser(admin, {
      userId: payload.userId,
      title,
      body,
      href: payload.href ?? undefined,
      type: payload.type,
      notificationId,
    }).catch((err) => console.warn("[notifications] push failed", err));
  }

  return { id: notificationId, skipped: false };
}

const BROADCAST_CHUNK = 40;

/** Fan-out in-app (+ push) to many users. */
export async function notifyUsers(
  admin: Admin,
  userIds: string[],
  payload: Omit<NotifyPayload, "userId">,
): Promise<{ created: number; skipped: number }> {
  const unique = [...new Set(userIds.filter(Boolean))];
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < unique.length; i += BROADCAST_CHUNK) {
    const chunk = unique.slice(i, i + BROADCAST_CHUNK);
    const results = await Promise.all(
      chunk.map((userId) => notifyUser(admin, { ...payload, userId })),
    );
    for (const r of results) {
      if (r.skipped) skipped += 1;
      else if (r.id) created += 1;
    }
  }

  return { created, skipped };
}
