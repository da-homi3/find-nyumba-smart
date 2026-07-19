import { supabase } from "@/integrations/supabase/client";
import { oauthCallbackUrl, rememberOAuthIntent } from "@/lib/auth/auth-gate";

/**
 * Start Google OAuth. New Google accounts become tenants via handle_new_user
 * (missing role metadata defaults to tenant) plus ensureTenantAccount on callback.
 */
export async function startGoogleAuth(options?: {
  nextPath?: string;
  /** Always tenant for popup / consumer Google signup. */
  role?: "tenant";
}): Promise<{ error: string | null }> {
  const nextPath = options?.nextPath ?? "/tenant";
  const role = options?.role ?? "tenant";
  rememberOAuthIntent(role, nextPath);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: oauthCallbackUrl(nextPath),
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}
