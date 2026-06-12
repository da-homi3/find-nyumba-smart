export type NotificationPrefs = {
  savedAlerts: boolean;
  messageUpdates: boolean;
  viewingReminders: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  savedAlerts: true,
  messageUpdates: true,
  viewingReminders: false,
};

function prefsKey(userId: string) {
  return `nyumba_tenant_notification_prefs:${userId}`;
}

export function readNotificationPrefs(userId?: string): NotificationPrefs {
  if (!userId || globalThis.localStorage === undefined) return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = globalThis.localStorage.getItem(prefsKey(userId));
    return raw ? { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) } : DEFAULT_NOTIFICATION_PREFS;
  } catch (err) {
    console.warn("[notification-prefs] Could not read prefs:", err);
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export function writeNotificationPrefs(userId: string, prefs: NotificationPrefs) {
  if (globalThis.localStorage === undefined) return;
  globalThis.localStorage.setItem(prefsKey(userId), JSON.stringify(prefs));
}
