import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ensureTenantAccount } from "@/lib/api/auth-tenant.functions";
import { consumeOAuthIntent, clearAuthGateDismiss } from "@/lib/auth/auth-gate";
import { withTimeout } from "@/lib/auth/with-timeout";
import { markSignupTourPending } from "@/lib/onboarding/tour-storage";
import { buildPageHead } from "@/lib/seo/head";
import { BrandLogoLink } from "@/components/BrandLogo";
import {
  isSafeRedirectPath,
  resolvePostLoginPath,
  type AppRole,
  type PortalId,
} from "@/lib/portal-guard";

const searchSchema = z.object({
  next: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const Route = createFileRoute("/auth/callback")({
  validateSearch: searchSchema,
  head: () =>
    buildPageHead({
      title: "Signing you in — NyumbaSearch",
      description: "Completing Google sign-in.",
      path: "/auth/callback",
      noIndex: true,
    }),
  component: AuthCallbackPage,
});

async function hasSession(): Promise<boolean> {
  const { data } = await withTimeout(
    supabase.auth.getSession(),
    4000,
    { data: { session: null }, error: null } as Awaited<ReturnType<typeof supabase.auth.getSession>>,
  );
  return Boolean(data.session?.user);
}

async function establishSessionFromUrl(): Promise<boolean> {
  const url = new URL(globalThis.location.href);
  const err = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (err) throw new Error(decodeURIComponent(err.replaceAll("+", " ")));

  // Give detectSessionInUrl a tick, then exchange PKCE code if needed.
  await new Promise((r) => setTimeout(r, 60));
  if (await hasSession()) return true;

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await withTimeout(
      supabase.auth.exchangeCodeForSession(code),
      8000,
      { data: { session: null, user: null }, error: new Error("Google sign-in timed out") } as Awaited<
        ReturnType<typeof supabase.auth.exchangeCodeForSession>
      >,
    );
    if (error && !(await hasSession())) throw error;
  }

  return hasSession();
}

async function resolveOAuthLandingPath(preferredNext: string): Promise<string> {
  const fallback = isSafeRedirectPath(preferredNext) ? preferredNext : "/tenant";
  const userRes = await withTimeout(supabase.auth.getUser(), 4000, null);
  const user = userRes?.data?.user ?? null;
  if (!user) return fallback;

  try {
    const results = await withTimeout(
      Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("active_portal").eq("id", user.id).maybeSingle(),
        supabase
          .from("portal_applications")
          .select("requested_role, status, created_at")
          .eq("user_id", user.id),
      ]),
      5000,
      null,
    );
    if (!results) return fallback;

    const [roleRes, profileRes, appsRes] = results;
    const roles = (roleRes.data ?? []).map((r) => r.role as AppRole);
    const activePortal = (profileRes.data?.active_portal as PortalId | null) ?? null;
    const redirect = isSafeRedirectPath(preferredNext) ? preferredNext : undefined;
    return resolvePostLoginPath(roles, activePortal, redirect, appsRes.data ?? []);
  } catch (err) {
    console.warn("[auth/callback] landing path lookup failed:", err);
    return fallback;
  }
}

function AuthCallbackPage() {
  const { next: nextParam } = Route.useSearch();
  const [message, setMessage] = useState("Finishing Google sign-in…");

  useEffect(() => {
    let cancelled = false;
    const hardStop = globalThis.setTimeout(() => {
      if (cancelled) return;
      setMessage("Taking too long — redirecting…");
      globalThis.location.replace(
        `/auth?mode=signin&redirect=${encodeURIComponent("/tenant")}`,
      );
    }, 15_000);

    void (async () => {
      try {
        const intent = consumeOAuthIntent();
        const preferredNext =
          (nextParam?.startsWith("/") ? nextParam : null) ?? intent.next ?? "/tenant";

        const ok = await establishSessionFromUrl();
        if (!ok) throw new Error("Could not complete Google sign-in. Try again.");

        void ensureTenantAccount().catch((err) => {
          console.warn("[auth/callback] ensureTenantAccount:", err);
        });

        const landing = await withTimeout(
          resolveOAuthLandingPath(preferredNext),
          6000,
          isSafeRedirectPath(preferredNext) ? preferredNext : "/tenant",
        );
        if (landing.startsWith("/tenant")) {
          markSignupTourPending("tenant");
        }
        clearAuthGateDismiss();
        if (!cancelled) setMessage("Success — taking you in…");
        globalThis.clearTimeout(hardStop);
        globalThis.location.replace(landing);
      } catch (err) {
        const text = err instanceof Error ? err.message : "Google sign-in failed";
        if (!cancelled) setMessage(text);
        console.error("[auth/callback]", err);
        globalThis.clearTimeout(hardStop);
        globalThis.setTimeout(() => {
          globalThis.location.replace(
            `/auth?mode=signin&redirect=${encodeURIComponent("/tenant")}`,
          );
        }, 2400);
      }
    })();

    return () => {
      cancelled = true;
      globalThis.clearTimeout(hardStop);
    };
  }, [nextParam]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <BrandLogoLink logoClassName="h-9" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
