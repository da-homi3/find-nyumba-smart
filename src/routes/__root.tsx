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
import { reportClientError } from "@/lib/error-reporting";
import {
  clearChunkReloadGuard,
  isChunkLoadError,
  reloadOnceForStaleChunk,
} from "@/lib/chunk-load-recovery";
import {
  APPLE_TOUCH_ICON_PATH,
  BRAND_LOGO_PATH,
  BRAND_THEME_COLOR,
  FAVICON_PATH,
  WEB_MANIFEST_PATH,
} from "@/lib/brand";
import { getOgImageUrl, HOMEPAGE_TITLE } from "@/lib/site";
import heroImg from "@/assets/hero-garden-city.jpg";
import { AuthProvider } from "@/hooks/use-auth";
import { CookieConsentBanner } from "@/components/CookieConsent";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition } from "@/components/motion/PageTransition";
import { useSmoothScroll } from "@/lib/smooth-scroll";

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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: HOMEPAGE_TITLE },
      {
        name: "description",
        content:
          "Discover verified vacant houses, apartments, and bedsitters across Nairobi — no agents, no scams.",
      },
      { name: "author", content: "NyumbaSearch" },
      { name: "theme-color", content: BRAND_THEME_COLOR },
      { name: "apple-mobile-web-app-title", content: "NyumbaSearch" },
      { name: "application-name", content: "NyumbaSearch" },
      { property: "og:title", content: HOMEPAGE_TITLE },
      {
        property: "og:description",
        content:
          "Discover verified vacant houses, apartments, and bedsitters across Nairobi — no agents, no scams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: HOMEPAGE_TITLE },
      {
        name: "twitter:description",
        content:
          "Discover verified vacant houses, apartments, and bedsitters across Nairobi — no agents, no scams.",
      },
      { property: "og:image", content: getOgImageUrl() },
      { name: "twitter:image", content: getOgImageUrl() },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: FAVICON_PATH, type: "image/png" },
      { rel: "apple-touch-icon", href: APPLE_TOUCH_ICON_PATH },
      { rel: "manifest", href: WEB_MANIFEST_PATH },
      { rel: "preload", as: "image", href: BRAND_LOGO_PATH, fetchPriority: "high" },
      { rel: "preload", as: "image", href: heroImg, fetchPriority: "high" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..900&family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600&display=swap",
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
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AnimatedOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Mapbox GL breaks when any ancestor has a CSS transform (PageTransition uses y).
  if (pathname.startsWith("/tenant/map")) {
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useSmoothScroll();

  useEffect(() => {
    clearChunkReloadGuard();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <AnimatedOutlet />
        </ErrorBoundary>
        <Toaster />
        <CookieConsentBanner />
      </AuthProvider>
    </QueryClientProvider>
  );
}
