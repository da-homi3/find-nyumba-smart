import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ensureTenantAccount } from "@/lib/api/auth-tenant.functions";
import { consumeOAuthIntent, clearAuthGateDismiss } from "@/lib/auth/auth-gate";
import { markSignupTourPending } from "@/lib/onboarding/tour-storage";
import { buildPageHead } from "@/lib/seo/head";
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
  const { data } = await supabase.auth.getSession();
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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error && !(await hasSession())) throw error;
  }

  return hasSession();
}

function AuthCallbackPage() {
  const { next: nextParam } = Route.useSearch();
  const [message, setMessage] = useState("Finishing Google sign-in…");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const intent = consumeOAuthIntent();
        const next =
          (nextParam?.startsWith("/") ? nextParam : null) ?? intent.next ?? "/tenant";

        const ok = await establishSessionFromUrl();
        if (!ok) throw new Error("Could not complete Google sign-in. Try again.");

        try {
          await ensureTenantAccount();
        } catch (err) {
          console.warn("[auth/callback] ensureTenantAccount:", err);
        }

        markSignupTourPending("tenant");
        clearAuthGateDismiss();
        if (!cancelled) setMessage("Success — taking you in…");
        globalThis.location.replace(next);
      } catch (err) {
        const text = err instanceof Error ? err.message : "Google sign-in failed";
        if (!cancelled) setMessage(text);
        console.error("[auth/callback]", err);
        globalThis.setTimeout(() => {
          globalThis.location.replace(`/auth?mode=signin&redirect=${encodeURIComponent("/tenant")}`);
        }, 2400);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nextParam]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <BrandLogoLink logoClassName="h-9" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
