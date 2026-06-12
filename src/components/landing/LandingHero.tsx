import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, ShieldCheck, MapPin, ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero-nairobi.jpg";
import { HOOD_META } from "@/components/landing/hood-meta";

export function LandingHero({
  verifiedCount,
  hoodCount,
}: Readonly<{ verifiedCount: number; hoodCount: number }>) {
  const navigate = useNavigate();
  const [hood, setHood] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [propType, setPropType] = useState("");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate({
      to: "/tenant",
      search: {
        ...(hood ? { neighborhood: hood } : {}),
        ...(maxRent ? { maxPrice: Number(maxRent) } : {}),
        ...(propType ? { type: propType } : {}),
      },
    });
  };

  return (
    <section className="relative isolate overflow-hidden">
      <img
        src={heroImg}
        alt="Aerial view of a leafy Nairobi neighbourhood at golden hour"
        width={1920}
        height={1280}
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-foreground/75 via-foreground/55 to-foreground/90" />
      <div className="relative mx-auto max-w-7xl px-5 pt-32 pb-24 sm:px-6 sm:pt-44 sm:pb-32">
        <div className="max-w-3xl text-background">
          <div className="inline-flex items-center gap-2 rounded-full border border-background/25 bg-background/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-gold" />
            {verifiedCount > 0
              ? `${verifiedCount.toLocaleString("en-KE")} verified homes`
              : "Verified listings"}{" "}
            · {hoodCount > 0 ? `${hoodCount} neighborhoods` : "Nairobi"}
          </div>
          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            Your next home in Nairobi — <span className="text-gold">verified, no agents</span>.
          </h1>
          <p className="mt-5 max-w-xl text-base text-background/80 sm:text-lg">
            Map-first search across thousands of vacant homes. Real reviews from past tenants. AI
            that warns you about red flags before you visit.
          </p>

          <form
            onSubmit={submit}
            className="mt-8 rounded-3xl border border-background/15 bg-background/95 p-3 text-foreground shadow-elegant backdrop-blur sm:p-4"
          >
            <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
              <label className="flex items-center gap-2 rounded-2xl border bg-card px-3 py-2.5">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <input
                  list="hood-suggestions"
                  value={hood}
                  onChange={(e) => setHood(e.target.value)}
                  placeholder="Neighborhood"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  aria-label="Neighborhood"
                />
                <datalist id="hood-suggestions">
                  {Object.keys(HOOD_META).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </label>
              <label className="flex items-center gap-2 rounded-2xl border bg-card px-3 py-2.5">
                <span className="text-xs font-semibold text-muted-foreground">KES</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={maxRent}
                  onChange={(e) => setMaxRent(e.target.value)}
                  placeholder="Max budget"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  aria-label="Maximum rent"
                />
              </label>
              <label className="flex items-center gap-2 rounded-2xl border bg-card px-3 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <select
                  value={propType}
                  onChange={(e) => setPropType(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  aria-label="Property type"
                >
                  <option value="">Any type</option>
                  <option value="bedsitter">Bedsitter</option>
                  <option value="studio">Studio</option>
                  <option value="one_bedroom">1 BR</option>
                  <option value="two_bedroom">2 BR</option>
                  <option value="three_bedroom">3 BR</option>
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-emerald px-5 py-3 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95"
              >
                Search
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 px-1 pb-1 pt-2 text-[11px] text-muted-foreground">
              <span className="font-medium">Popular:</span>
              {["Kilimani", "Westlands", "Karen", "Lavington", "Kasarani"].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setHood(n)}
                  className="rounded-full bg-secondary px-2.5 py-0.5 font-medium text-secondary-foreground hover:bg-accent"
                >
                  {n}
                </button>
              ))}
            </div>
          </form>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/tenant"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-gold px-6 py-3.5 text-sm font-semibold text-gold-foreground shadow-elegant transition hover:translate-y-[-1px]"
            >
              Browse homes
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link
              to="/tenant/map"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-background/30 bg-background/10 px-6 py-3.5 text-sm font-semibold text-background backdrop-blur hover:bg-background/20"
            >
              <MapPin className="h-4 w-4" />
              Open the map
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
