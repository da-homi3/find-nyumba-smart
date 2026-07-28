import type { SupabaseClient } from "@supabase/supabase-js";
import { SignJWT, importPKCS8 } from "jose";
import type { Database } from "@/integrations/supabase/types";
import type { NotificationType } from "@/lib/notifications/types";

type Admin = SupabaseClient<Database>;

export type PushPayload = {
  userId: string;
  title: string;
  body: string;
  href?: string;
  type: NotificationType;
  notificationId: string;
};

type PushTokenRow = { id: string; token: string; platform: string };
type PushSendResult = "ok" | "gone" | "error";

function fcmEnabled(): boolean {
  return process.env.FCM_SEND_ENABLED === "true";
}

function vapidConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_SUBJECT?.trim(),
  );
}

function normalizePrivateKeyPem(raw: string): string {
  const trimmed = raw.trim().replaceAll(String.raw`\n`, "\n");
  if (trimmed.includes("BEGIN")) return trimmed;
  return `-----BEGIN PRIVATE KEY-----\n${trimmed}\n-----END PRIVATE KEY-----`;
}

let cachedFcmAccessToken: { token: string; exp: number } | null = null;

async function getFcmAccessToken(): Promise<string | null> {
  const email = process.env.FCM_CLIENT_EMAIL?.trim();
  const key = process.env.FCM_PRIVATE_KEY?.trim();
  if (!email || !key) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cachedFcmAccessToken && cachedFcmAccessToken.exp > now + 60) {
    return cachedFcmAccessToken.token;
  }

  const pk = await importPKCS8(normalizePrivateKeyPem(key), "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(pk);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    console.warn("[push] FCM token exchange failed", await res.text());
    return null;
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  cachedFcmAccessToken = {
    token: json.access_token,
    exp: now + (json.expires_in ?? 3600),
  };
  return json.access_token;
}

async function sendFcm(
  deviceToken: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  const projectId = process.env.FCM_PROJECT_ID?.trim();
  const access = await getFcmAccessToken();
  if (!projectId || !access) return "error";

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title: payload.title, body: payload.body },
          data: {
            href: payload.href ?? "/",
            type: payload.type,
            notificationId: payload.notificationId,
          },
          android: { priority: "HIGH" },
        },
      }),
    },
  );

  if (res.ok) return "ok";
  const text = await res.text();
  if (res.status === 404 || text.includes("UNREGISTERED") || text.includes("NOT_FOUND")) {
    return "gone";
  }
  console.warn("[push] FCM send failed", res.status, text.slice(0, 300));
  return "error";
}

type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function parseWebSubscription(token: string): WebPushSubscription | null {
  try {
    const parsed = JSON.parse(token) as WebPushSubscription;
    if (parsed?.endpoint && parsed.keys?.p256dh && parsed.keys?.auth) return parsed;
  } catch {
    /* not JSON */
  }
  return null;
}

async function sendWebPush(
  subscription: WebPushSubscription,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!vapidConfigured()) return "error";
  try {
    const { buildPushPayload } = await import("@block65/webcrypto-web-push");
    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      href: payload.href ?? "/",
      type: payload.type,
      notificationId: payload.notificationId,
    });
    const built = await buildPushPayload(
      {
        data: message,
        options: { ttl: 60 * 60 * 12, urgency: "normal" },
      },
      {
        endpoint: subscription.endpoint,
        expirationTime: null,
        keys: subscription.keys,
      },
      {
        subject: process.env.VAPID_SUBJECT!,
        publicKey: process.env.VAPID_PUBLIC_KEY!,
        privateKey: process.env.VAPID_PRIVATE_KEY!,
      },
    );

    const res = await fetch(subscription.endpoint, {
      method: built.method,
      headers: built.headers as HeadersInit,
      body: built.body as BodyInit,
    });
    if (res.status === 201 || res.status === 200) return "ok";
    if (res.status === 404 || res.status === 410) return "gone";
    console.warn("[push] web push failed", res.status, (await res.text()).slice(0, 200));
    return "error";
  } catch (err) {
    console.warn("[push] web push error", err);
    return "error";
  }
}

async function loadTokens(admin: Admin, userId: string): Promise<PushTokenRow[]> {
  const { data } = await admin
    .from("push_tokens")
    .select("id, token, platform")
    .eq("user_id", userId);
  const rows: PushTokenRow[] = (data ?? []).map((r) => ({
    id: r.id,
    token: r.token,
    platform: r.platform,
  }));

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  // fcm_token column exists in DB (android migration) but may be missing from generated types
  if (profile) {
    const { data: fcmRow } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    const fcm = (fcmRow as { fcm_token?: string | null } | null)?.fcm_token?.trim();
    if (fcm && !rows.some((r) => r.token === fcm)) {
      rows.push({ id: `profile:${userId}`, token: fcm, platform: "android" });
    }
  }
  return rows;
}

async function pruneToken(admin: Admin, row: PushTokenRow): Promise<void> {
  if (row.id.startsWith("profile:")) {
    const userId = row.id.slice("profile:".length);
    await admin
      .from("profiles")
      .update({ fcm_token: null } as never)
      .eq("id", userId);
    return;
  }
  await admin.from("push_tokens").delete().eq("id", row.id);
}

/** Send push to all registered devices for a user (no-op when send flags/keys missing). */
export async function sendPushToUser(admin: Admin, payload: PushPayload): Promise<void> {
  if (!fcmEnabled() && !vapidConfigured()) return;

  const tokens = await loadTokens(admin, payload.userId);
  if (!tokens.length) return;

  for (const row of tokens) {
    const webSub = parseWebSubscription(row.token);
    let result: PushSendResult = "error";

    if (webSub || row.platform === "web") {
      if (webSub && vapidConfigured()) {
        result = await sendWebPush(webSub, payload);
      }
    } else if (fcmEnabled()) {
      result = await sendFcm(row.token, payload);
    }

    if (result === "gone") {
      await pruneToken(admin, row).catch(() => undefined);
    }
  }
}
