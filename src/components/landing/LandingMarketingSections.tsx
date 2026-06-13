import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ShieldCheck,
  MapPin,
  Sparkles,
  Droplets,
  Building2,
  Star,
  Smartphone,
  Apple,
  PlayCircle,
  BadgeCheck,
  Camera,
  Bot,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export function VerifiedSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const levels = [
    { icon: Smartphone, title: "Phone verified", desc: "Landlord reachable via verified line." },
    { icon: BadgeCheck, title: "ID verified", desc: "National ID matched to landlord profile." },
    { icon: Building2, title: "Business verified", desc: "Registered agency or property company." },
    { icon: Camera, title: "Ownership verified", desc: "Title deed or lease cross-checked." },
  ];

  useGSAP(
    () => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 60%",
          end: "bottom 20%",
          scrub: 1,
        },
      });
      tl.from(".verify-card:nth-child(1)", { x: -100, opacity: 0, rotation: -5 })
        .from(".verify-card:nth-child(2)", { y: 60, opacity: 0 }, "-=0.3")
        .from(".verify-card:nth-child(3)", { x: 100, opacity: 0, rotation: 5 }, "-=0.3")
        .from(".verify-card:nth-child(4)", { y: -60, opacity: 0, scale: 0.8 }, "-=0.3");
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      id="verification-section"
      className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20"
    >
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {levels.map((l, i) => (
            <motion.div
              key={l.title}
              className="verify-card relative overflow-hidden rounded-[20px] border border-white/10 bg-glass-bg p-6 backdrop-blur-xl"
              whileHover={{ y: -8, boxShadow: "0 24px 60px rgba(30,184,138,0.3)" }}
            >
              <div
                className="pointer-events-none absolute right-4 top-2 font-display text-7xl font-extrabold leading-none text-[rgba(30,184,138,0.06)]"
                aria-hidden
              >
                {i + 1}
              </div>
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-emerald text-primary-foreground">
                  <l.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">Level {i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{l.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{l.desc}</p>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(i + 1) * 25}%` }}
                  transition={{ duration: 1, delay: 0.2 }}
                  className="h-full rounded-full bg-gradient-emerald"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PropertyIntelSection() {
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

export function WhyNyumba() {
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
      icon: ShieldCheck,
      title: "NyumbaSearch Verified",
      body: "On-site inspection, ownership checks, and vacancy confirmation before you pay a deposit.",
      link: "/verify",
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
          {items.map((f) => {
            const inner = (
              <>
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-emerald text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </>
            );
            return "link" in f && f.link ? (
              <Link
                key={f.title}
                to={f.link}
                className="rounded-2xl border bg-card p-6 shadow-soft transition hover:border-primary/30"
              >
                {inner}
              </Link>
            ) : (
              <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-soft">
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Testimonials() {
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
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={`${t.name}-${star}`} className="h-4 w-4 fill-current" />
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

export function DownloadApp() {
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

export function LandlordBand() {
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
