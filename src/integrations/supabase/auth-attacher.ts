import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

/** Keep a hot token so server-fn calls don't block on getSession after login. */
let cachedAccessToken: string | null = null;
const GET_SESSION_TIMEOUT_MS = 2500;
const TIMEOUT_SENTINEL = Symbol("getSessionTimeout");

async function warmCachedAccessToken() {
  const result = await Promise.race([
    supabase.auth.getSession(),
    new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
      globalThis.setTimeout(() => resolve(TIMEOUT_SENTINEL), GET_SESSION_TIMEOUT_MS);
    }),
  ]);
  if (result === TIMEOUT_SENTINEL) return;
  cachedAccessToken = result.data.session?.access_token ?? null;
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
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
          globalThis.setTimeout(() => resolve(TIMEOUT_SENTINEL), GET_SESSION_TIMEOUT_MS);
        }),
      ]);
      // On timeout keep any existing cache; do not force-clear the Bearer header.
      if (result !== TIMEOUT_SENTINEL) {
        token = result.data.session?.access_token ?? null;
        cachedAccessToken = token;
      }
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
