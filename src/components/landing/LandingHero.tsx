import { Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type SubmitEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Search, MapPin, ArrowRight, ShieldCheck, BadgeCheck, Clock, Star } from "lucide-react";
import heroApartments from "@/assets/hero-nairobi-apartments.webp";
import heroVilla from "@/assets/hero-kenya-villa.webp";
import { HOOD_META } from "@/components/landing/hood-meta";
import { LiveStatsGlassCard } from "@/components/landing/LiveStatsGlassCard";
import { HOMEPAGE_DESCRIPTION } from "@/lib/site";
import type { PropertyType } from "@/lib/properties";
import type { PublicStats } from "@/lib/api/stats.functions";
import { useDeviceCapability, useMotionBudget } from "@/hooks/useDeviceCapability";
import { SSR_SAFE_MOTION_INITIAL } from "@/lib/design/motion";
import { cn } from "@/lib/utils";

const HeroScene3D = lazy(() =>
  import("@/components/hero/HeroScene3D").then((m) => ({ default: m.HeroScene3D })),
);

const HERO_SLIDES = [heroApartments, heroVilla] as const;
const HERO_CROSSFADE_MS = 9000;

const POPULAR_HOODS = ["Kilimani", "Westlands", "Karen", "Lavington", "Kasarani"] as const;

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "bedsitter", label: "Bedsitter" },
  { value: "studio", label: "Studio" },
  { value: "one_bedroom", label: "1 BR" },
  { value: "two_bedroom", label: "2 BR" },
  { value: "three_bedroom", label: "3 BR" },
  { value: "townhouse", label: "4 BR+" },
  { value: "maisonette", label: "Maisonette" },
  { value: "bungalow", label: "Bungalow" },
];

const PURPOSE_TABS = [
  { id: "rent" as const, label: "Rent", purpose: "rent" as const },
  { id: "buy" as const, label: "Buy", purpose: "sale" as const },
  { id: "short" as const, label: "Short Let", purpose: "rent" as const },
];

const MIN_BUDGET_KES = 1_000;
const MAX_BUDGET_KES = 2_000_000;

const MICRO_TRUST = [
  { icon: BadgeCheck, label: "Verified listings" },
  { icon: ShieldCheck, label: "No agent fees" },
  { icon: Clock, label: "Fast responses" },
  { icon: Star, label: "Trusted tenants" },
] as const;

export function LandingHero({
  publicStats,
  statsLoading = false,
}: Readonly<{
  publicStats?: PublicStats | null;
  statsLoading?: boolean;
}>) {
  const navigate = useNavigate();
  const capable3D = useDeviceCapability();
  const motionBudget = useMotionBudget();
  const reduceMotion = useReducedMotion();
  const [slide, setSlide] = useState(0);
  const [hood, setHood] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [propType, setPropType] = useState<PropertyType | "">("");
  const [purposeTab, setPurposeTab] = useState<(typeof PURPOSE_TABS)[number]["id"]>("rent");

  useEffect(() => {
    if (reduceMotion || HERO_SLIDES.length < 2) return;
    const id = window.setInterval(() => {
      setSlide((s) => (s + 1) % HERO_SLIDES.length);
    }, HERO_CROSSFADE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    let budget: number | undefined;
    if (maxRent.trim()) {
      const parsed = Number(maxRent);
      if (!Number.isFinite(parsed)) return;
      budget = Math.min(MAX_BUDGET_KES, Math.max(MIN_BUDGET_KES, parsed));
    }
    const tab = PURPOSE_TABS.find((t) => t.id === purposeTab);
    const search: {
      neighborhood?: string;
      maxPrice?: number;
      type?: PropertyType;
      purpose?: "rent" | "sale";
    } = {};
    if (hood) search.neighborhood = hood;
    if (typeof budget === "number") search.maxPrice = budget;
    if (propType) search.type = propType;
    if (tab) search.purpose = tab.purpose;
    navigate({ to: "/tenant", search });
  };

  return (
    <section className="relative isolate min-h-dvh overflow-hidden bg-(--surface-0) sm:min-h-[92vh]">
      <div className="hero-photo-layer z-0" aria-hidden>
        {HERO_SLIDES.map((src, i) => (
          <div key={src} className={cn("hero-slide", i === slide && "is-active")}>
            <img
              src={src}
              alt=""
              width={1920}
              height={1080}
              sizes="100vw"
              fetchPriority={i === 0 ? "high" : "low"}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              className={cn("hero-kenburns", reduceMotion && "animate-none")}
            />
          </div>
        ))}
        <div className="hero-gradient-overlay" />
        <div className="hero-edge-blur" />
      </div>

      {capable3D ? (
        <Suspense fallback={null}>
          <div className="pointer-events-none absolute inset-0 z-1 opacity-90">
            <HeroScene3D budget={motionBudget} />
          </div>
        </Suspense>
      ) : null}

      <div
        className="pointer-events-none absolute inset-0 z-1 opacity-60"
        style={{ background: "var(--surface-glow)" }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col justify-center gap-10 px-4 pb-24 pt-28 sm:min-h-[92vh] sm:px-6 sm:pb-20 sm:pt-32 lg:flex-row lg:items-center lg:gap-12">
        <div className="flex-1 text-left">
          <motion.div
            initial={SSR_SAFE_MOTION_INITIAL}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85 backdrop-blur-md"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
            Verified homes across Nairobi
          </motion.div>

          <motion.h1
            initial={SSR_SAFE_MOTION_INITIAL}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="display-heading mt-5 max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]"
          >
            Your next home in Nairobi <span className="text-primary-glow">starts here</span>
          </motion.h1>

          <motion.p
            initial={SSR_SAFE_MOTION_INITIAL}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-4 max-w-lg text-sm leading-relaxed text-white/70 sm:text-base"
          >
            {HOMEPAGE_DESCRIPTION}
          </motion.p>

          <motion.form
            onSubmit={submit}
            initial={SSR_SAFE_MOTION_INITIAL}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="glass-panel mt-8 overflow-hidden rounded-2xl"
          >
            <div
              className="flex gap-1 border-b border-white/10 p-1.5"
              role="tablist"
              aria-label="Search purpose"
            >
              {PURPOSE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={purposeTab === tab.id}
                  onClick={() => setPurposeTab(tab.id)}
                  className={cn(
                    "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition sm:text-sm",
                    purposeTab === tab.id
                      ? "bg-white/15 text-white"
                      : "text-white/55 hover:bg-white/5 hover:text-white/80",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid gap-0 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
              <label className="flex flex-col gap-1 border-b border-white/10 px-4 py-3 text-left sm:border-r sm:border-b-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                  Where in Nairobi?
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
                  <input
                    list="hood-suggestions"
                    value={hood}
                    onChange={(e) => setHood(e.target.value)}
                    placeholder="Neighborhood"
                    className="w-full bg-transparent text-sm text-white outline-none transition placeholder:text-white/40"
                    aria-label="Neighborhood"
                  />
                </span>
                <datalist id="hood-suggestions">
                  {Object.keys(HOOD_META).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1 border-b border-white/10 px-4 py-3 text-left sm:border-r sm:border-b-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                  Property Type
                </span>
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
                  <select
                    value={propType}
                    onChange={(e) => setPropType(e.target.value as PropertyType | "")}
                    className="w-full bg-transparent text-sm text-white outline-none"
                    aria-label="Property type"
                  >
                    <option value="" className="text-foreground">
                      Any type
                    </option>
                    {PROPERTY_TYPES.map(({ value, label }) => (
                      <option key={value} value={value} className="text-foreground">
                        {label}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="flex flex-col gap-1 border-b border-white/10 px-4 py-3 text-left sm:border-r sm:border-b-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                  Price Range
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white/50">KES</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={MIN_BUDGET_KES}
                    max={MAX_BUDGET_KES}
                    value={maxRent}
                    onChange={(e) => setMaxRent(e.target.value)}
                    placeholder="Max budget"
                    className="w-full bg-transparent text-sm text-white outline-none transition placeholder:text-white/40"
                    aria-label="Maximum rent"
                  />
                </span>
              </label>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2 bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-green"
              >
                Search
                <ArrowRight className="h-4 w-4" aria-hidden />
              </motion.button>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs text-white/50">
              <span className="font-medium">Popular:</span>
              {POPULAR_HOODS.map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setHood(n)}
                  className="rounded-full bg-white/10 px-3 py-0.5 font-medium text-white/80 transition hover:bg-white/20"
                >
                  {n}
                </button>
              ))}
            </div>
          </motion.form>

          <motion.ul
            initial={SSR_SAFE_MOTION_INITIAL}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-5 flex flex-wrap gap-x-4 gap-y-2"
          >
            {MICRO_TRUST.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/55"
              >
                <Icon className="h-3.5 w-3.5 text-emerald-300/90" aria-hidden />
                {label}
              </li>
            ))}
          </motion.ul>

          <motion.div
            initial={SSR_SAFE_MOTION_INITIAL}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.48 }}
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <Link
              to="/tenant"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-(--shadow-green)"
            >
              Browse homes
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/tenant/map"
              className="glass-panel inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3 text-sm font-semibold text-white"
            >
              <MapPin className="h-4 w-4" aria-hidden />
              Open the map
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={SSR_SAFE_MOTION_INITIAL}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="mx-auto w-full max-w-sm shrink-0 lg:mx-0"
        >
          <LiveStatsGlassCard stats={publicStats} loading={statsLoading} />
        </motion.div>
      </div>

      {!reduceMotion ? (
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-center text-xs text-white/40"
        >
          <div className="mx-auto mb-2 h-10 w-px bg-white/20" />
          scroll
        </motion.div>
      ) : null}
    </section>
  );
}
