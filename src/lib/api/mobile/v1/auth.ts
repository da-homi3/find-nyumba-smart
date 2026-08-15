import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type MobileAdmin = SupabaseClient<Database>;

export const MOBILE_JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

export function mobileJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: MOBILE_JSON_HEADERS,
  });
}

export function mobileError(message: string, code: string, status: number): Response {
  return mobileJson({ error: message, code, status }, status);
}

/** Accept Flutter and legacy Android WebView clients. */
export function isMobileAppClient(req: Request): boolean {
  const client = (req.headers.get("X-App-Client") ?? "").trim().toLowerCase();
  return client === "flutter" || client === "android";
}

export function requireFlutterClient(req: Request): Response | null {
  const client = (req.headers.get("X-App-Client") ?? "").trim().toLowerCase();
  if (client !== "flutter") {
    return mobileError("Flutter app client required", "APP_CLIENT_REQUIRED", 403);
  }
  return null;
}

export async function requireMobileBearer(
  req: Request,
): Promise<{ admin: MobileAdmin; user: User; userId: string } | Response> {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!bearer) {
    return mobileError("Missing bearer token", "UNAUTHORIZED", 401);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(bearer);
  if (error || !data.user) {
    return mobileError("Unauthorized", "UNAUTHORIZED", 401);
  }

  return { admin: supabaseAdmin, user: data.user, userId: data.user.id };
}

export async function userHasRole(
  admin: MobileAdmin,
  userId: string,
  role: Database["public"]["Enums"]["app_role"],
): Promise<boolean> {
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const roles = new Set((data ?? []).map((r) => r.role));
  return roles.has("admin") || roles.has(role);
}
