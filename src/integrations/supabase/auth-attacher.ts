import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";
import { withTimeout } from "@/lib/auth/with-timeout";

/** Keep a hot token so server-fn calls don't block on getSession after login. */
let cachedAccessToken: string | null = null;

async function warmCachedAccessToken() {
  const { data } = await supabase.auth.getSession();
  cachedAccessToken = data.session?.access_token ?? null;
}

function bootstrapAuthTokenCache() {
  if (typeof window === "undefined") return;
  void warmCachedAccessToken();
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token ?? null;
  });
}

bootstrapAuthTokenCache();

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token = cachedAccessToken;
    if (!token) {
      const { data } = await withTimeout(
        supabase.auth.getSession(),
        2500,
        { data: { session: null }, error: null } as Awaited<
          ReturnType<typeof supabase.auth.getSession>
        >,
      );
      token = data.session?.access_token ?? null;
      cachedAccessToken = token;
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
