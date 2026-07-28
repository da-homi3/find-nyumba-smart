import { registerPushToken } from "@/lib/api/search.functions";

function isAndroidWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  return /; wv\)|NyumbaSearchAndroid/i.test(navigator.userAgent);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.codePointAt(i) ?? 0;
  }
  return output;
}

type RegisterWebPushOptions = {
  /** Only call Notification.requestPermission from a user gesture. */
  requestPermission?: boolean;
};

/** Subscribe to web push and store subscription JSON in push_tokens. */
export async function registerWebPushSubscription(
  options: RegisterWebPushOptions = {},
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isAndroidWebView()) return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (!("Notification" in window)) return false;

  const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublic?.trim()) return false;

  try {
    let permission = Notification.permission;
    if (permission === "default" && options.requestPermission) {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    sub ??= await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublic.trim()) as BufferSource,
    });

    await registerPushToken({
      data: {
        token: JSON.stringify(sub.toJSON()),
        platform: "web",
      },
    });
    return true;
  } catch (err) {
    console.warn("[web-push] subscribe failed", err);
    return false;
  }
}
