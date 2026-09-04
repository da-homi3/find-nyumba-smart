import { isPesapalConfigured } from "@/lib/api/pesapal";
import { getServerEnv } from "@/lib/server-env";

/** Returns true when the inbound Pesapal IPN request passes shared-secret checks. */
export function verifyPesapalWebhookRequest(request: Request): boolean {
  const secret = getServerEnv("PESAPAL_WEBHOOK_SECRET")?.trim();
  const isLive = (getServerEnv("PESAPAL_ENV") || "").toLowerCase() === "live";

  if (isLive && isPesapalConfigured() && !secret) {
    return false;
  }

  if (!secret) return true;

  const auth = request.headers.get("authorization");
  const querySecret = new URL(request.url).searchParams.get("secret");
  return auth === `Bearer ${secret}` || querySecret === secret;
}
