import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { SSR_SAFE_MOTION_INITIAL } from "@/lib/design/motion";
import { cn } from "@/lib/utils";

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=ke.co.nyumbasearch.app";

const DISMISS_KEY = "nyumba-app-banner-dismissed-v1";

function PlayBadge({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      className={className}
      viewBox="0 0 135 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="135" height="40" rx="6" fill="#000" />
      <path
        fill="#EA4335"
        d="M10.5 8.2c-.4.4-.7 1.1-.7 1.9v19.8c0 .8.3 1.5.7 1.9l.1.1 11.1-11.1v-.5L10.6 8.1l-.1.1z"
      />
      <path
        fill="#FBBC04"
        d="M28.4 26.1 24.3 22l-2.7 2.7 11.3 6.4c.7-.4 1.2-1.1 1.2-2.1 0-.3 0-.5-.1-.7l-5.6-2.2z"
      />
      <path
        fill="#4285F4"
        d="M34.1 18.1c0-1-.5-1.8-1.2-2.2L21.6 9.5l-2.8 2.8 4.1 4.1.1-.1 10.6 6c.1-.2.5-.4.5-1.2z"
      />
      <path
        fill="#34A853"
        d="M21.6 20.5 18.8 17.7 10.5 29c.5.5 1.2.6 1.9.2l12.1-6.9-2.9-1.8z"
      />
      <text
        x="42"
        y="15"
        fill="#fff"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="8"
      >
        GET IT ON
      </text>
      <text
        x="42"
        y="29"
        fill="#fff"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="14"
        fontWeight="700"
      >
        Google Play
      </text>
    </svg>
  );
}

function AppStoreComingSoon({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-black/40 px-3 text-left text-white",
        className,
      )}
      aria-label="App Store — coming soon"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current" aria-hidden>
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.22-2 1.08-3.15C13.02.5 11.73 1.2 10.95 2.05c-.69.75-1.3 1.95-1.13 3.09 1.19.09 2.41-.61 3.18-1.64" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[9px] uppercase tracking-wide text-white/70">App Store</span>
        <span className="block text-sm font-semibold">Coming soon</span>
      </span>
    </span>
  );
}

/** Full-bleed homepage strip — Play live, App Store coming soon. */
export function AppDownloadBanner({ className }: Readonly<{ className?: string }>) {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className={cn("relative isolate overflow-hidden border-y border-white/10", className)}
      aria-label="Download NyumbaSearch"
    >
      <div
        className="absolute inset-0 bg-[linear-gradient(115deg,#0b1f1a_0%,#102820_38%,#0c1220_72%,#111827_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 20%, rgba(52,211,153,0.45), transparent 42%), radial-gradient(circle at 88% 70%, rgba(251,191,36,0.22), transparent 36%), repeating-linear-gradient(90deg, transparent 0, transparent 46px, rgba(255,255,255,0.04) 46px, rgba(255,255,255,0.04) 47px)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full border border-emerald-400/20 sm:h-72 sm:w-72"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-6 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full border border-emerald-300/15 sm:h-52 sm:w-52"
        aria-hidden
      />

      <motion.div
        className="relative mx-auto flex max-w-7xl flex-col items-start gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-12"
        initial={SSR_SAFE_MOTION_INITIAL}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-xl">
          <div className="flex items-center gap-3">
            <BrandLogo variant="icon" iconClassName="h-11 w-11 rounded-xl ring-1 ring-white/15" />
            <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
              NyumbaSearch app
            </p>
          </div>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Homes in your pocket.
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
            Search verified rentals, unlock contacts, and manage tenancy from Android — built for
            Kenya’s networks and M-Pesa.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80"
            >
              <span className="sr-only">Download NyumbaSearch on Google Play</span>
              <PlayBadge className="h-11 w-auto drop-shadow-lg" />
            </a>
            <AppStoreComingSoon />
          </div>
          <p className="text-[11px] text-white/45 sm:text-right">
            Free on Google Play · App Store launch coming soon
          </p>
        </div>
      </motion.div>
    </section>
  );
}

/** Slim sticky promo for non-landing pages (dismissible). */
export function AppDownloadStickyBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (globalThis.localStorage?.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // ignore
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-900/40 bg-[linear-gradient(90deg,#0b1f1a,#12261f_55%,#0f172a)] px-3 py-2.5 shadow-[0_-8px_28px_rgba(0,0,0,0.35)] md:bottom-4 md:left-1/2 md:right-auto md:w-[min(40rem,calc(100%-2rem))] md:-translate-x-1/2 md:rounded-2xl md:border md:px-4">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <BrandLogo variant="icon" iconClassName="h-9 w-9 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-white">
            Get the Android app
          </p>
          <p className="truncate text-[11px] text-white/60">App Store coming soon</p>
        </div>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-emerald-950 hover:bg-emerald-300"
        >
          Play Store
        </a>
        <button
          type="button"
          aria-label="Dismiss app download banner"
          className="rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
          onClick={() => {
            try {
              globalThis.localStorage?.setItem(DISMISS_KEY, "1");
            } catch {
              // ignore
            }
            setVisible(false);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
