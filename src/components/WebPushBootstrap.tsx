import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { registerWebPushSubscription } from "@/lib/notifications/register-web-push";

/**
 * After sign-in, re-register an existing granted web-push subscription.
 * Never prompts — Notification.requestPermission must stay behind a user gesture.
 */
export function WebPushBootstrap() {
  const { user } = useAuth();
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (attempted.current === user.id) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    attempted.current = user.id;
    const timer = globalThis.setTimeout(() => {
      void registerWebPushSubscription();
    }, 2500);
    return () => globalThis.clearTimeout(timer);
  }, [user?.id]);

  return null;
}
