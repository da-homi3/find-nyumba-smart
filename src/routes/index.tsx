import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, ShieldCheck, MapPin, Sparkles, ArrowRight, Building2 } from "lucide-react";
import heroImg from "@/assets/hero-nairobi.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NyumbaSearch — Find Verified Homes Smarter" },
      {
        name: "description",
        content:
          "Discover verified vacant homes across Nairobi. Maps, intelligence, direct contact — no agents.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="absolute top-0 inset-x-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2 text-background">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold text-gold-foreground font-bold">
              N
            </div>
            <span className="font-display text-xl font-semibold tracking-tight">NyumbaSearch</span>
          </div>
          <Link
            to="/landlord"
            className="rounded-full border border-background/30 bg-background/10 px-4 py-2 text-sm font-medium text-background backdrop-blur hover:bg-background/20"
          >
            Landlord Access
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroImg}
          alt="Aerial view of a leafy Nairobi neighbourhood at golden hour"
          width={1920}
          height={1280}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/70 via-foreground/55 to-foreground/85" />
        <div className="relative mx-auto max-w-7xl px-6 pt-40 pb-32 sm:pt-48 sm:pb-40">
          <div className="max-w-2xl text-background">
            <div className="inline-flex items-center gap-2 rounded-full border border-background/25 bg-background/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" />
              Verified listings · Nairobi
            </div>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Find your next home, <span className="text-gold">smarter</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-background/80">
              Skip the agents. Browse thousands of verified vacant houses, apartments and bedsitters
              across Nairobi — with maps, intel, and direct landlord contact.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/tenant"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-gold px-7 py-4 text-base font-semibold text-gold-foreground shadow-elegant transition hover:translate-y-[-1px]"
              >
                <Search className="h-5 w-5" />
                Search Houses
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              <Link
                to="/landlord"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-background/30 bg-background/10 px-7 py-4 text-base font-semibold text-background backdrop-blur hover:bg-background/20"
              >
                <Building2 className="h-5 w-5" />
                I'm a Landlord
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
              {[
                { k: "10k+", v: "Verified homes" },
                { k: "98%", v: "No agent fee" },
                { k: "24h", v: "Avg response" },
              ].map((s) => (
                <div key={s.v}>
                  <div className="font-display text-2xl font-semibold text-gold">{s.k}</div>
                  <div className="text-xs text-background/70">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Verified vacancies",
              body: "Every listing is checked. No ghost houses, no scam deposits.",
            },
            {
              icon: MapPin,
              title: "Map-first discovery",
              body: "See water reliability, security, commute and noise — overlaid on the map.",
            },
            {
              icon: Sparkles,
              title: "AI that helps",
              body: "Recommends neighbourhoods, warns about red flags, compares like a friend.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-7 shadow-soft">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-emerald text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Landlord band */}
      <section className="border-t bg-secondary">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-12 md:flex-row">
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

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} NyumbaSearch · Built for Nairobi.
      </footer>
    </div>
  );
}
