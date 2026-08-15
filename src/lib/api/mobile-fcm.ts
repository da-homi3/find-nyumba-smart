import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

/** Store FCM token against profiles — sending remains feature-flagged off server-side. */
export async function registerFcmToken(
  admin: Admin,
  userId: string,
  token: string,
): Promise<{ stored: boolean }> {
  const trimmed = token.trim();
  if (!trimmed) throw new Error("token required");

  const { error } = await admin
    .from("profiles")
    .update({
      fcm_token: trimmed,
      fcm_token_updated_at: new Date().toISOString(),
    } as Database["public"]["Tables"]["profiles"]["Update"])
    .eq("id", userId);

  if (error) throw error;
  return { stored: true };
}

function isAllowedMobileClient(req: Request): boolean {
  const client = (req.headers.get("X-App-Client") ?? "").trim().toLowerCase();
  // Legacy WebView uses "android"; Flutter uses "flutter". Both must keep working.
  return client === "android" || client === "flutter";
}

export async function handleFcmTokenRequest(req: Request): Promise<Response> {
  if (!isAllowedMobileClient(req)) {
    return new Response(JSON.stringify({ error: "App client required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { token?: string };
  try {
    body = (await req.json()) as { token?: string };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = body.token?.trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "token required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Feature-flag: storage enabled; push sending stays off until FCM_SEND_ENABLED=true
  const sendEnabled = process.env.FCM_SEND_ENABLED === "true";

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!bearer) {
    return new Response(
      JSON.stringify({ ok: true, stored: false, reason: "auth_required", sendEnabled }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.getUser(bearer);
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await registerFcmToken(supabaseAdmin, data.user.id, token);
    const client = (req.headers.get("X-App-Client") ?? "android").trim().toLowerCase();
    const platform = client === "flutter" ? "flutter" : "android";
    await supabaseAdmin
      .from("push_tokens")
      .upsert({ user_id: data.user.id, token, platform }, { onConflict: "user_id,token" });
    return new Response(JSON.stringify({ ok: true, ...result, sendEnabled }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("FCM token registration error:", err);
    return new Response(JSON.stringify({ error: "Could not store token" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
