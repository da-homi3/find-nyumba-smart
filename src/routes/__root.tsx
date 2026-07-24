import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";

import appCss from "../styles.css?url";
import "@/lib/random-uuid";
import { reportClientError } from "@/lib/error-reporting";
import {
  clearChunkReloadGuard,
  isChunkLoadError,
  reloadOnceForStaleChunk,
} from "@/lib/chunk-load-recovery";
import {
  APPLE_TOUCH_ICON_PATH,
  BRAND_ICON_192_PATH,
  BRAND_THEME_COLOR,
  FAVICON_96_PATH,
  FAVICON_ICO_PATH,
  FAVICON_PATH,
  WEB_MANIFEST_PATH,
} from "@/lib/brand";
import { getOgImageUrl, HOMEPAGE_DESCRIPTION, HOMEPAGE_TITLE } from "@/lib/site";
import { AuthProvider } from "@/hooks/use-auth";
import { CookieConsentBanner } from "@/components/CookieConsent";
import { FullStoryBootstrap } from "@/components/FullStoryBootstrap";
import { PresenceBootstrap } from "@/components/PresenceBootstrap";
import { TenantBottomNav } from "@/components/TenantBottomNav";
import { AmbientBackdrop } from "@/components/motion/AmbientBackdrop";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { RequireAccountPhoneModal } from "@/components/auth/RequireAccountPhoneModal";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition } from "@/components/motion/PageTransition";
import { useSmoothScroll } from "@/lib/smooth-scroll";
import { shouldShowTenantBottomNav } from "@/lib/tenant-mobile-nav";
import { registerPwaServiceWorker } from "@/lib/register-pwa";
import { InstallAppBanner } from "@/components/InstallAppBanner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: Readonly<{ error: Error; reset: () => void }>) {
  console.error(error);
  const router = useRouter();
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (chunkError) {
      reloadOnceForStaleChunk();
      return;
    }
    reportClientError(error, { boundary: "tanstack_root_error_component" });
  }, [error, chunkError]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">
          {chunkError ? "App update available" : "This page didn't load"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {chunkError
            ? "A newer version of NyumbaSearch is live. Refresh to load it."
            : "Something went wrong on our end."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (chunkError) {
                globalThis.location.reload();
                return;
              }
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {chunkError ? "Refresh" : "Try again"}
          </button>
          <a
            href="/"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "author", content: "NyumbaSearch" },
      { name: "application-name", content: "NyumbaSearch" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "NyumbaSearch" },
      { name: "theme-color", content: BRAND_THEME_COLOR },
      { name: "format-detection", content: "telephone=no" },
      { property: "og:site_name", content: "NyumbaSearch" },
      { title: HOMEPAGE_TITLE },
      {
        name: "description",
        content: HOMEPAGE_DESCRIPTION,
      },
      { property: "og:title", content: HOMEPAGE_TITLE },
      {
        property: "og:description",
        content: HOMEPAGE_DESCRIPTION,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: HOMEPAGE_TITLE },
      {
        name: "twitter:description",
        content: HOMEPAGE_DESCRIPTION,
      },
      { property: "og:image", content: getOgImageUrl() },
      { name: "twitter:image", content: getOgImageUrl() },
      // Optional: set GOOGLE_SITE_VERIFICATION in Worker env after GSC setup
      ...(typeof process !== "undefined" && process.env.GOOGLE_SITE_VERIFICATION
        ? [{ name: "google-site-verification", content: process.env.GOOGLE_SITE_VERIFICATION }]
        : []),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: FAVICON_ICO_PATH, sizes: "any" },
      { rel: "icon", href: FAVICON_PATH, type: "image/png", sizes: "48x48" },
      { rel: "icon", href: FAVICON_96_PATH, type: "image/png", sizes: "96x96" },
      { rel: "icon", href: BRAND_ICON_192_PATH, type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: APPLE_TOUCH_ICON_PATH, sizes: "180x180" },
      { rel: "manifest", href: WEB_MANIFEST_PATH },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen overflow-x-clip antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AnimatedOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Skip exit-wait transitions on tenant sections — they feel like lag between tabs.
  const skipTransition =
    pathname === "/" ||
    pathname.startsWith("/tenant/map") ||
    pathname === "/tenant" ||
    pathname.startsWith("/tenant/") ||
    pathname.startsWith("/landlord") ||
    pathname.startsWith("/agency") ||
    pathname.startsWith("/manager");

  if (skipTransition) {
    return <Outlet />;
  }
  return (
    <AnimatePresence mode="wait">
      <PageTransition key={pathname}>
        <Outlet />
      </PageTransition>
    </AnimatePresence>
  );
}

function TenantMobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!shouldShowTenantBottomNav(pathname)) return null;
  return <TenantBottomNav />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useSmoothScroll();

  useEffect(() => {
    clearChunkReloadGuard();
    registerPwaServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AmbientBackdrop />
        <div className="relative z-10">
          <ErrorBoundary>
            <AnimatedOutlet />
          </ErrorBoundary>
          <TenantMobileNav />
          <Toaster />
          <CookieConsentBanner />
          <InstallAppBanner />
          <AuthGateModal />
          <RequireAccountPhoneModal />
          <FullStoryBootstrap />
          <PresenceBootstrap />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}
