import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type SubmitEvent } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero-garden-city.jpg";
import { HOOD_META } from "@/components/landing/hood-meta";
import type { PropertyType } from "@/lib/properties";

const POPULAR_HOODS = ["Kilimani", "Westlands", "Karen", "Lavington", "Kasarani"] as const;

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "bedsitter", label: "Bedsitter" },
  { value: "studio", label: "Studio" },
  { value: "one_bedroom", label: "1 BR" },
  { value: "two_bedroom", label: "2 BR" },
  { value: "three_bedroom", label: "3 BR" },
];

export function LandingHero({
  verifiedCount,
  hoodCount,
}: Readonly<{ verifiedCount: number; hoodCount: number }>) {
  const navigate = useNavigate();
  const [hood, setHood] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [propType, setPropType] = useState<PropertyType | "">("");

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate({
      to: "/tenant/",
      search: {
        ...(hood ? { neighborhood: hood } : {}),
        ...(maxRent ? { maxPrice: Number(maxRent) } : {}),
        ...(propType ? { type: propType } : {}),
      },
    });
  };

  return (
    <section className="relative isolate min-h-screen overflow-hidden bg-(--color-obsidian)">
      <div className="absolute inset-0 z-0" aria-hidden>
        <img
          src={heroImg}
          alt="Aerial view of a garden city with green-roof buildings, winding paths, and a central pond at golden hour"
          width={1920}
          height={1280}
          sizes="100vw"
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-1 bg-linear-to-b from-[rgba(13,17,23,0.35)] via-[rgba(13,17,23,0.15)] to-[rgba(13,17,23,0.88)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-5 py-32 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(30,184,138,0.4)] bg-[rgba(30,184,138,0.15)] px-4 py-1.5 text-sm font-medium text-[#1eb88a]"
        >
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-[#1eb88a]" />
          {verifiedCount > 0
            ? `${verifiedCount.toLocaleString("en-KE")} verified homes`
            : "Verified listings"}{" "}
          · {hoodCount > 0 ? `${hoodCount} neighborhoods` : "Nairobi"}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
          className="max-w-4xl text-white"
        >
          Your next home in Nairobi —
          <br />
          <span className="text-[#1eb88a]">verified</span>, no agents.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-5 max-w-xl text-lg text-white/70"
        >
          Map-first search across Nairobi. Real reviews. AI that warns about red flags before you
          visit.
        </motion.p>

        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-(--glass-border) bg-glass-bg shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl"
        >
          <div className="grid gap-0 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="flex items-center gap-2 border-b border-white/10 px-4 py-3 sm:border-r sm:border-b-0">
              <MapPin className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
              <input
                list="hood-suggestions"
                value={hood}
                onChange={(e) => setHood(e.target.value)}
                placeholder="Neighborhood"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                aria-label="Neighborhood"
              />
              <datalist id="hood-suggestions">
                {Object.keys(HOOD_META).map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </label>
            <label className="flex items-center gap-2 border-b border-white/10 px-4 py-3 sm:border-r sm:border-b-0">
              <span className="text-xs font-semibold text-white/50">KES</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={maxRent}
                onChange={(e) => setMaxRent(e.target.value)}
                placeholder="Max budget"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                aria-label="Maximum rent"
              />
            </label>
            <label className="flex items-center gap-2 border-b border-white/10 px-4 py-3 sm:border-r sm:border-b-0">
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
            </label>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2 bg-[#1eb88a] px-6 py-3.5 text-sm font-semibold text-white"
            >
              Search
              <ArrowRight className="h-4 w-4" aria-hidden />
            </motion.button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3 text-xs text-white/50">
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

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/tenant/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1eb88a] px-8 py-3.5 text-sm font-semibold text-white shadow-(--shadow-green)"
            >
              Browse homes
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/tenant/map"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-md"
            >
              <MapPin className="h-4 w-4" aria-hidden />
              Open the map ↗
            </Link>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-center text-xs text-white/40"
      >
        <div className="mx-auto mb-2 h-10 w-px bg-white/20" />
        scroll
      </motion.div>
    </section>
  );
}
