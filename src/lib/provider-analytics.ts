import { trackProviderEvent } from "@/lib/api/service-provider.functions";

export type ProviderAnalyticsEventType =
  | "profile_view"
  | "directory_view"
  | "contact_click"
  | "quote_request";

const seen = new Set<string>();

function sessionKey(providerId: string, eventType: ProviderAnalyticsEventType): string {
  return `${providerId}:${eventType}`;
}

/** Fire-and-forget analytics ping — deduped once per page session per event type. */
export function trackProviderAnalytics(
  providerId: string,
  eventType: ProviderAnalyticsEventType,
  metadata?: Record<string, string>,
): void {
  if (!providerId || providerId.startsWith("placeholder")) return;
  const key = sessionKey(providerId, eventType);
  if (seen.has(key)) return;
  seen.add(key);
  trackProviderEvent({
    data: { providerId, eventType, metadata },
  }).catch(() => {
    seen.delete(key);
  });
}
