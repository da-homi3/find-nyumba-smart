import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useRef, useEffect } from "react";
import { useCountUp } from "@/hooks/use-count-up";
import {
  Search,
  ShieldCheck,
  MapPin,
  Sparkles,
  Droplets,
  ArrowRight,
  Building2,
  Star,
  Smartphone,
  Apple,
  PlayCircle,
  Eye,
  BadgeCheck,
  Camera,
  Bot,
  TrendingUp,
} from "lucide-react";
import heroImg from "@/assets/hero-nairobi.jpg";
import { fetchProperties } from "@/lib/properties";
import { PropertyCard } from "@/components/PropertyCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NyumbaSearch — Find Verified Homes in Nairobi, Smarter" },
      {
        name: "description",
        content:
          "Discover verified vacant homes across Nairobi. Map-first search, real reviews, AI guidance — no agent fees, no scams.",
      },
      { property: "og:title", content: "NyumbaSearch — Verified homes in Nairobi" },
      {
        property: "og:description",
        content:
          "Skip the agents. Map-first search across thousands of verified vacant homes in Nairobi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { rel: "canonical", href: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

function Landing() {
  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: () => fetchProperties(),
  });

  const verified = useMemo(() => properties.filter((p) => p.is_verified).slice(0, 8), [properties]);

  const popularNeighborhoods = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of properties) {
      counts.set(p.neighborhood, (counts.get(p.neighborhood) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [properties]);

  const stats = useMemo(() => {
    const total = properties.length;
    const verifiedCount = properties.filter((p) => p.is_verified).length;
    const hoods = new Set(properties.map((p) => p.neighborhood)).size;
    const avgRent = total ? Math.round(properties.reduce((s, p) => s + p.rent_kes, 0) / total) : 0;
    return { total, verifiedCount, hoods, avgRent };
  }, [properties]);

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <Hero verifiedCount={stats.verifiedCount} hoodCount={stats.hoods} />
      <TrustStrip />
      <FeaturedListings verified={verified} />
      <PopularNeighborhoods hoods={popularNeighborhoods} />
      <VerifiedSection />
      <PropertyIntelSection />
      <WhyNyumba />
      <Testimonials />
      <DownloadApp />
      <LandlordBand />
      <SiteFooter />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "RealEstateAgent",
            name: "NyumbaSearch",
            areaServed: "Nairobi, Kenya",
            url: "https://find-nyumba-smart.lovable.app",
            description:
              "Verified vacant homes across Nairobi with map-first search, real reviews, and direct landlord contact.",
          }),
        }}
      />
    </div>
  );
}

/* ----------------------------- Sections ----------------------------- */

function SiteNav() {
  return (
    <header className="absolute top-0 inset-x-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-background">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold text-gold-foreground font-bold">
            N
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">NyumbaSearch</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {[
            { to: "/tenant", label: "Browse" },
            { to: "/tenant/map", label: "Map" },
            { to: "/landlord", label: "Landlords" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-full px-4 py-2 text-sm font-medium text-background/85 hover:bg-background/10 hover:text-background"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          to="/auth"
          search={{ redirect: "/tenant" } as never}
          className="rounded-full border border-background/30 bg-background/10 px-4 py-2 text-sm font-medium text-background backdrop-blur hover:bg-background/20"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}

const HOOD_META: Record<string, { from: number; img: string }> = {
  Kilimani: { from: 18000, img: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400" },
  Westlands: {
    from: 25000,
    img: "https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=400",
  },
  Karen: { from: 50000, img: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400" },
  Lavington: {
    from: 45000,
    img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400",
  },
  Kileleshwa: {
    from: 35000,
    img: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400",
  },
  Kasarani: {
    from: 12000,
    img: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400",
  },
  "South B": {
    from: 20000,
    img: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400",
  },
  Roysambu: { from: 8000, img: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=400" },
  Rongai: { from: 12000, img: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400" },
  Ruaka: { from: 15000, img: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400" },
};

function Hero({ verifiedCount, hoodCount }: { verifiedCount: number; hoodCount: number }) {
  const navigate = useNavigate();
  const [hood, setHood] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [propType, setPropType] = useState("");

  const submit = (e: React.FormEvent) => {
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

          {/* Search card */}
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

function TrustStrip() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), {
      threshold: 0.3,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const homes = useCountUp(10000, 1400, visible);
  const fees = useCountUp(98, 1000, visible);
  const hours = useCountUp(24, 800, visible);
  const rating = useCountUp(47, 900, visible);
  const items = [
    { k: `${homes >= 10000 ? "10k+" : homes.toLocaleString()}`, v: "Verified homes" },
    { k: `${fees}%`, v: "No agent fees" },
    { k: `${hours}h`, v: "Avg response" },
    { k: `${(rating / 10).toFixed(1)}★`, v: "Tenant rating" },
  ];
  return (
    <section ref={ref} aria-label="Trust statistics" className="border-y bg-secondary">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-8 sm:grid-cols-4 sm:px-6">
        {items.map((s) => (
          <div key={s.v} className="text-center sm:text-left">
            <div className="font-display text-2xl font-semibold text-primary sm:text-3xl tabular-nums">
              {s.k}
            </div>
            <div className="text-xs text-muted-foreground">{s.v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturedListings({ verified }: { verified: import("@/lib/properties").Property[] }) {
  if (!verified.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Featured</p>
          <h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
            Verified homes, ready to view
          </h2>
        </div>
        <Link
          to="/tenant"
          className="hidden text-sm font-semibold text-primary hover:underline sm:inline"
        >
          See all →
        </Link>
      </div>

      <div className="mt-8 flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
        {verified.map((p) => (
          <div key={p.id} className="w-72 shrink-0 sm:w-auto">
            <PropertyCard p={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

function PopularNeighborhoods({ hoods }: { hoods: { name: string; count: number }[] }) {
  const fallback = [
    "Kilimani",
    "Westlands",
    "Karen",
    "Lavington",
    "Kileleshwa",
    "Kasarani",
    "South B",
    "Roysambu",
  ];
  const items = hoods.length ? hoods : fallback.map((name) => ({ name, count: 0 }));

  return (
    <section className="border-t bg-secondary/40">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Where Nairobi lives
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
              Popular neighborhoods
            </h2>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((h) => {
            const meta = HOOD_META[h.name];
            return (
              <Link
                key={h.name}
                to="/tenant"
                search={{ neighborhood: h.name }}
                className="group overflow-hidden rounded-2xl border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
              >
                {meta?.img && (
                  <div className="aspect-[16/9] overflow-hidden bg-muted">
                    <img
                      src={meta.img}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-display text-base font-semibold">{h.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {meta
                        ? `From KES ${meta.from.toLocaleString()}/mo`
                        : h.count > 0
                          ? `${h.count} homes`
                          : "Explore"}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function VerifiedSection() {
  const levels = [
    { icon: Smartphone, title: "Phone verified", desc: "Landlord reachable via verified line." },
    { icon: BadgeCheck, title: "ID verified", desc: "National ID matched to landlord profile." },
    { icon: Building2, title: "Business verified", desc: "Registered agency or property company." },
    { icon: Camera, title: "Ownership verified", desc: "Title deed or lease cross-checked." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Trust system
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
            4 levels of verification.
            <br />
            Zero room for scams.
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Every listing on NyumbaSearch is screened. Landlords build trust by verifying phone, ID,
            business, and property ownership — visible to you on every card.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified Landlord
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/30 px-3 py-1 text-xs font-semibold text-foreground">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified Property
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
              <TrendingUp className="h-3.5 w-3.5" /> Trust score
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {levels.map((l, i) => (
            <div key={l.title} className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-emerald text-primary-foreground">
                  <l.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">Level {i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{l.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{l.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PropertyIntelSection() {
  const layers = [
    {
      icon: Droplets,
      title: "Water reliability",
      desc: "Community-reported supply quality and borehole data before you sign.",
      stat: "72% of Kilimani listings have borehole backup",
    },
    {
      icon: ShieldCheck,
      title: "Security",
      desc: "Gated compounds, guard presence, and neighbourhood safety scores.",
      stat: "Level 3+ verified homes average 4.2/5 security",
    },
    {
      icon: Sparkles,
      title: "Internet",
      desc: "Safaricom, Zuku, and Faiba availability per building.",
      stat: "89% of Westlands listings report fibre-ready",
    },
  ];
  return (
    <section className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Property intelligence
        </p>
        <h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
          Know before you visit
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {layers.map((l) => (
            <div key={l.title} className="rounded-2xl border bg-card p-6 shadow-soft">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <l.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{l.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{l.desc}</p>
              <p className="mt-3 text-xs font-semibold text-primary">{l.stat}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyNyumba() {
  const items = [
    {
      icon: ShieldCheck,
      title: "Verified vacancies",
      body: "Every listing is screened. No ghost houses, no scam deposits.",
    },
    {
      icon: MapPin,
      title: "Map-first discovery",
      body: "Water reliability, security, commute and noise — layered on the map.",
    },
    {
      icon: Bot,
      title: "AI that helps",
      body: "Recommends neighborhoods, warns about red flags, compares like a friend.",
    },
    {
      icon: Eye,
      title: "Real reviews",
      body: "Honest ratings from past tenants on security, water and landlord.",
    },
  ];
  return (
    <section className="border-t bg-secondary/40">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Why NyumbaSearch
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
            Built for the Nairobi tenant.
          </h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-soft">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-emerald text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    {
      name: "Faith W.",
      role: "Tenant · Kilimani",
      body: "Found my 1BR in two days. The verified badge actually meant something — landlord picked up on the first call.",
    },
    {
      name: "Brian O.",
      role: "Tenant · Westlands",
      body: "Honest reviews on water and security saved me from a place that looked perfect online. Worth its weight in gold.",
    },
    {
      name: "Achieng' M.",
      role: "Landlord · Lavington",
      body: "Filled a vacancy in 9 days, all leads pre-qualified. Way better than dealing with random WhatsApp brokers.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          From the community
        </p>
        <h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
          People moving with confidence.
        </h2>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {items.map((t) => (
          <figure
            key={t.name}
            className="flex h-full flex-col rounded-2xl border bg-card p-6 shadow-soft"
          >
            <div className="flex gap-0.5 text-gold">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/85">
              "{t.body}"
            </blockquote>
            <figcaption className="mt-5">
              <div className="font-display text-sm font-semibold">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.role}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function DownloadApp() {
  return (
    <section className="border-t bg-gradient-emerald text-primary-foreground">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-16 sm:px-6 sm:py-20 lg:flex-row lg:items-center">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Coming soon</p>
          <h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
            Take NyumbaSearch with you.
          </h2>
          <p className="mt-3 text-primary-foreground/80">
            Save searches, get instant alerts when verified homes match your budget, and message
            landlords on the go.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-3 rounded-2xl border border-primary-foreground/30 bg-background/10 px-5 py-3 text-left text-sm backdrop-blur hover:bg-background/20"
            aria-label="Download on the App Store (coming soon)"
          >
            <Apple className="h-6 w-6" />
            <span>
              <span className="block text-[10px] uppercase tracking-wider opacity-80">
                Download on the
              </span>
              <span className="block font-display text-base font-semibold">App Store</span>
            </span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-3 rounded-2xl border border-primary-foreground/30 bg-background/10 px-5 py-3 text-left text-sm backdrop-blur hover:bg-background/20"
            aria-label="Get it on Google Play (coming soon)"
          >
            <PlayCircle className="h-6 w-6" />
            <span>
              <span className="block text-[10px] uppercase tracking-wider opacity-80">
                Get it on
              </span>
              <span className="block font-display text-base font-semibold">Google Play</span>
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

function LandlordBand() {
  return (
    <section className="border-t bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-12 sm:px-6 md:flex-row md:items-center">
        <div>
          <h3 className="font-display text-2xl font-semibold">List your property in minutes</h3>
          <p className="mt-1 text-muted-foreground">
            Reach verified tenants directly. Track leads, views and conversions.
          </p>
        </div>
        <Link
          to="/landlord"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Open Landlord Portal <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-6 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-gold text-gold-foreground font-bold">
              N
            </div>
            <span className="font-display text-lg font-semibold">NyumbaSearch</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            The trusted way to find a home in Nairobi. Built for tenants and landlords, free of
            brokers.
          </p>
        </div>
        <FooterCol
          title="Tenants"
          links={[
            { to: "/tenant", label: "Browse homes" },
            { to: "/tenant/map", label: "Map view" },
            { to: "/tenant/saved", label: "Saved" },
          ]}
        />
        <FooterCol
          title="Landlords"
          links={[
            { to: "/landlord", label: "Landlord portal" },
            { to: "/landlord/dashboard", label: "Dashboard" },
            { to: "/landlord/properties/new", label: "List a property" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { to: "/about", label: "About" },
            { to: "/contact", label: "Contact" },
            { to: "/pricing", label: "Pricing" },
            { to: "/caretaker", label: "Caretaker" },
            { to: "/manager/dashboard", label: "Property manager" },
          ]}
        />
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-6 sm:flex-row sm:px-6">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} NyumbaSearch · Made in Nairobi 🇰🇪
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <a href="#" className="hover:text-primary">
              Twitter
            </a>
            <a href="#" className="hover:text-primary">
              LinkedIn
            </a>
            <a href="#" className="hover:text-primary">
              Instagram
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <div className="font-display text-sm font-semibold">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="hover:text-primary">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
