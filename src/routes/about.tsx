import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { buildPageHead } from "@/lib/seo/head";

export const Route = createFileRoute("/about")({
  head: () =>
    buildPageHead({
      title: "About — NyumbaSearch",
      description:
        "NyumbaSearch helps Nairobi renters find vacant homes from verified property owners. Built in Kenya for Kenyan renters and landlords.",
      path: "/about",
    }),
  component: AboutPage,
});

const TEAM = [
  { name: "Faith Wanjiku", role: "Co-founder & Product", initials: "FW" },
  { name: "Kevin Buluma", role: "Co-founder & Engineering", initials: "KB" },
  { name: "NyumbaSearch Ops", role: "Verification & Trust", initials: "NS" },
];

function AboutPage() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-display text-4xl font-semibold">About NyumbaSearch</h1>
        <p className="mt-6 text-muted-foreground leading-relaxed">
          NyumbaSearch helps Nairobi renters find vacant homes from verified property owners — no scams.
          We layer property intelligence — water reliability, security, internet, commute — on every
          listing so you can decide before you visit.
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          We started NyumbaSearch after seeing too many young professionals lose deposits to fake
          agents and ghost listings. Landlords list directly, verify in stages, and message tenants
          in-platform. No middlemen, no hidden viewing fees.
        </p>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold">Built in Nairobi, for Nairobi</h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            From Kilimani walk-ups to Karen townhouses, every feature is designed around how Kenyans
            actually search for homes — M-Pesa payments, WhatsApp-style messaging, and neighbourhood
            intelligence you will not find on generic portals.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold">Team</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {TEAM.map((member) => (
              <div key={member.name} className="rounded-2xl border bg-card p-4 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-emerald text-lg font-bold text-primary-foreground">
                  {member.initials}
                </div>
                <p className="mt-3 font-semibold">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.role}</p>
              </div>
            ))}
          </div>
        </section>

        <Link
          to="/contact"
          className="mt-12 inline-flex items-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Get in touch →
        </Link>
      </main>
    </PublicPageShell>
  );
}
