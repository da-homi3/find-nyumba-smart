import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { submitInquiry } from "@/lib/submit-inquiry";
import type { FeaturedTestimonial, PropertyIntelligenceStats } from "@/lib/api/homepage-shared";
import { FALLBACK_INTELLIGENCE } from "@/lib/api/homepage-shared";
import { VerificationPipeline } from "@/components/VerificationPipeline";
import { IntelligenceMetric } from "@/components/IntelligenceMetric";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";
import {
  ScrollReveal,
  ScrollRevealStagger,
  ScrollRevealItem,
} from "@/components/motion/ScrollReveal";
import {
  ShieldCheck,
  MapPin,
  Sparkles,
  Droplets,
  BadgeCheck,
  Bot,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

export function VerifiedSection() {
  return (
    <section
      id="verification-section"
      className="relative overflow-hidden border-y border-white/6 bg-(--surface-0)"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 70% 40%, rgba(30,184,138,0.07), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Trust system
            </p>
            <h2 className="display-heading mt-1 text-3xl font-semibold sm:text-4xl">
              4 levels of verification.
              <br />
              Zero room for scams.
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Every listing on NyumbaSearch is screened. Landlords build trust by verifying phone,
              ID, business, and property ownership — visible to you on every card.
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
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <VerificationPipeline />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

export function PropertyIntelSection({
  stats,
  loading = false,
}: Readonly<{ stats?: PropertyIntelligenceStats; loading?: boolean }>) {
  const intel = stats ?? FALLBACK_INTELLIGENCE;
  const layers = [
    {
      icon: <Droplets className="h-5 w-5" />,
      title: "Water reliability",
      desc: "Community-reported supply quality and borehole data before you sign.",
      stat:
        intel.kilimaniSampleSize > 0
          ? `${intel.kilimaniBoreholePercent}% of Kilimani listings have borehole backup`
          : `${intel.kilimaniBoreholePercent}% of Kilimani listings have borehole backup (est.)`,
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      title: "Security",
      desc: "Gated compounds, guard presence, and neighbourhood safety scores.",
      stat: `Level 3+ verified homes average ${intel.avgSecurityScore}/5 security`,
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      title: "Internet",
      desc: "Safaricom, Zuku, and Faiba availability per building.",
      stat:
        intel.westlandsSampleSize > 0
          ? `${intel.westlandsFibrePercent}% of Westlands listings report fibre-ready`
          : `${intel.westlandsFibrePercent}% of Westlands listings report fibre-ready (est.)`,
    },
  ];

  return (
    <section className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
        <ScrollReveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Property intelligence
          </p>
          <h2 className="display-heading mt-1 text-3xl font-semibold sm:text-4xl">
            Know before you visit
          </h2>
        </ScrollReveal>
        <ScrollRevealStagger className="mt-10 grid gap-5 sm:grid-cols-3" stagger={0.08}>
          {layers.map((l) => (
            <ScrollRevealItem key={l.title}>
              <IntelligenceMetric
                icon={l.icon}
                title={l.title}
                description={l.desc}
                stat={l.stat}
                loading={loading}
              />
            </ScrollRevealItem>
          ))}
        </ScrollRevealStagger>
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
        <ScrollReveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Why NyumbaSearch
          </p>
          <h2 className="display-heading mt-1 text-3xl font-semibold sm:text-4xl">
            Built for the Nairobi tenant.
          </h2>
        </ScrollReveal>
        <ScrollRevealStagger
          className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          stagger={0.08}
        >
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
            return (
              <ScrollRevealItem key={f.title}>
                {"link" in f && f.link ? (
                  <Link
                    to={f.link}
                    className="block rounded-2xl border bg-card p-6 shadow-soft transition hover:border-primary/30"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="rounded-2xl border bg-card p-6 shadow-soft">{inner}</div>
                )}
              </ScrollRevealItem>
            );
          })}
        </ScrollRevealStagger>
      </div>
    </section>
  );
}

export function Testimonials({
  items,
  loading = false,
}: Readonly<{ items: FeaturedTestimonial[]; loading?: boolean }>) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20">
      <ScrollReveal className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          From the community
        </p>
        <h2 className="display-heading mt-1 text-3xl font-semibold sm:text-4xl">
          People moving with confidence.
        </h2>
      </ScrollReveal>
      <ScrollReveal className="mt-10" delay={0.1}>
        {loading ? (
          <div className="mx-auto h-56 max-w-3xl animate-pulse rounded-3xl bg-muted" />
        ) : (
          <TestimonialCarousel testimonials={items} />
        )}
      </ScrollReveal>
    </section>
  );
}

export function DownloadApp() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [platform, setPlatform] = useState<"ios" | "android" | "both">("both");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <section className="border-t bg-gradient-emerald text-primary-foreground">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-16 sm:px-6 sm:py-20 lg:flex-row lg:items-center">
        <ScrollReveal className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Coming soon</p>
          <h2 className="display-heading mt-1 text-3xl font-semibold sm:text-4xl">
            NyumbaSearch on your phone
          </h2>
          <p className="mt-3 text-primary-foreground/80">
            Map search, instant notifications, M-Pesa payments, and NyumbaAI — in your pocket. Be
            first to know when it drops.
          </p>
        </ScrollReveal>
        {done ? (
          <div className="rounded-2xl border border-primary-foreground/30 bg-background/10 px-5 py-4 text-sm backdrop-blur">
            <p className="font-semibold">You&apos;re on the list!</p>
            <p className="mt-1 text-primary-foreground/80">
              We&apos;ll notify you at {email} the moment the app launches.
            </p>
          </div>
        ) : (
          <form
            className="flex w-full max-w-md flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting || !email.includes("@")) return;
              setSubmitting(true);
              const ok = await submitInquiry(
                {
                  inquiryType: "app_notify",
                  email,
                  phone: phone.trim() || undefined,
                  subject: "Mobile app launch notification",
                  message: `Notify when NyumbaSearch mobile app launches (${platform})`,
                  metadata: {
                    source: "homepage_download_section",
                    platform,
                    phone: phone.trim(),
                  },
                },
                "You're on the list — check your email for confirmation.",
              );
              setSubmitting(false);
              if (ok) setDone(true);
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="rounded-xl border border-primary-foreground/30 bg-background/10 px-4 py-3 text-sm text-primary-foreground placeholder:text-primary-foreground/50 backdrop-blur transition focus:border-[#1eb88a] focus:shadow-[0_0_0_3px_rgba(30,184,138,0.15)] focus:outline-none"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone / WhatsApp (optional)"
              className="rounded-xl border border-primary-foreground/30 bg-background/10 px-4 py-3 text-sm text-primary-foreground placeholder:text-primary-foreground/50 backdrop-blur transition focus:border-[#1eb88a] focus:shadow-[0_0_0_3px_rgba(30,184,138,0.15)] focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["ios", "iOS"],
                  ["android", "Android"],
                  ["both", "Both"],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPlatform(val)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    platform === val
                      ? "border-gold bg-gold/20 text-gold"
                      : "border-primary-foreground/30 text-primary-foreground/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <motion.button
              type="submit"
              disabled={submitting}
              whileTap={{ scale: 0.97 }}
              className="rounded-xl bg-background px-5 py-3 text-sm font-semibold text-foreground disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Notify me at launch"}
            </motion.button>
          </form>
        )}
      </div>
    </section>
  );
}

export function LandlordBand() {
  return (
    <section className="border-t bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-12 sm:px-6 md:flex-row md:items-center">
        <ScrollReveal>
          <h3 className="font-display text-2xl font-semibold">List your property in minutes</h3>
          <p className="mt-1 text-muted-foreground">
            Reach verified tenants directly. Track leads, views and conversions.
          </p>
        </ScrollReveal>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
          <Link
            to="/landlord"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Open Landlord Portal <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
