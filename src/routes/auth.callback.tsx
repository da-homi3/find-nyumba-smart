import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ensureTenantAccount } from "@/lib/api/auth-tenant.functions";
import { consumeOAuthIntent, consumePendingSignupPolicy } from "@/lib/auth/auth-gate";
import {
  navigateAfterAuth,
  resolveAuthLandingForUser,
  waitForAuthSession,
} from "@/lib/auth/post-login";
import { withTimeout } from "@/lib/auth/with-timeout";
import { markSignupTourPending } from "@/lib/onboarding/tour-storage";
import { buildPageHead } from "@/lib/seo/head";
import { isSafeRedirectPath } from "@/lib/portal-guard";
import { BrandLogoLink } from "@/components/BrandLogo";

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
  const { data } = await withTimeout(supabase.auth.getSession(), 4000, {
    data: { session: null },
    error: null,
  } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
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
    const { error } = await withTimeout(supabase.auth.exchangeCodeForSession(code), 25_000, {
      data: { session: null, user: null },
      error: new Error("Google sign-in timed out"),
    } as Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>>);
    if (error && !(await hasSession())) throw error;
  }

  return hasSession();
}

async function applyPendingSignupPolicyToUser() {
  const acceptance = consumePendingSignupPolicy();
  if (!acceptance) return;
  try {
    await supabase.auth.updateUser({
      data: {
        terms_policy_version: acceptance.version,
        terms_policy_accepted_at: acceptance.acceptedAt,
        terms_policy_role: acceptance.role,
      },
    });
  } catch (err) {
    console.warn("[auth/callback] could not persist pending signup policy:", err);
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
      globalThis.location.replace(`/auth?mode=signin&redirect=${encodeURIComponent("/tenant")}`);
    }, 45_000);

    void (async () => {
      try {
        const intent = consumeOAuthIntent();
        const preferredNext =
          (nextParam?.startsWith("/") ? nextParam : null) ?? intent.next ?? "/tenant";

        const ok = await establishSessionFromUrl();
        if (!ok) throw new Error("Could not complete Google sign-in. Try again.");

        await waitForAuthSession();
        await applyPendingSignupPolicyToUser();

        void ensureTenantAccount().catch((err) => {
          console.warn("[auth/callback] ensureTenantAccount:", err);
        });

        const {
          data: { user },
        } = await supabase.auth.getUser();
        const fallback = isSafeRedirectPath(preferredNext) ? preferredNext : "/tenant";
        const landing = user
          ? await withTimeout(
              resolveAuthLandingForUser(user.id, preferredNext),
              6_000,
              fallback,
            )
          : fallback;

        if (landing.startsWith("/tenant")) {
          markSignupTourPending("tenant");
        }
        if (!cancelled) setMessage("Success — taking you in…");
        globalThis.clearTimeout(hardStop);
        navigateAfterAuth(landing);
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
