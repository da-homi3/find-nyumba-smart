import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";
import { VERIFICATION_TIERS } from "@/lib/revenue/plans";
import { formatKes } from "@/lib/properties";
import { ShieldCheck, Home, FileCheck } from "lucide-react";

export const Route = createFileRoute("/verify/")({
  head: () => ({ meta: [{ title: "Property verification — NyumbaSearch" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-4xl px-5 py-12">
        <section className="text-center">
          <h1 className="font-display text-4xl font-semibold">
            Is the property real? We&apos;ll check.
          </h1>
          <p className="mt-4 text-muted-foreground">
            NyumbaSearch sends a trained agent to physically verify the property, confirm it&apos;s
            vacant, and cross-check ownership before you pay a deposit.
          </p>
          <Link
            to="/verify/request"
            className="mt-8 inline-block rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground"
          >
            Verify a property
          </Link>
        </section>

        <section className="mt-16 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: Home,
              title: "Site inspection",
              desc: "We visit and confirm it matches photos.",
            },
            {
              icon: FileCheck,
              title: "Ownership check",
              desc: "ID and title deed cross-reference.",
            },
            {
              icon: ShieldCheck,
              title: "Vacancy confirmation",
              desc: "Unit is genuinely available.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-5">
              <f.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold">Pricing</h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50 text-left">
                  <th className="p-4">Service</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Turnaround</th>
                </tr>
              </thead>
              <tbody>
                {VERIFICATION_TIERS.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="p-4 font-medium">{t.name}</td>
                    <td className="p-4">{formatKes(t.priceKes)}</td>
                    <td className="p-4 text-muted-foreground">{t.turnaround}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Over 2,400 verifications completed · 98% accuracy rate · Full refund if property is
          fraudulent
        </p>
      </main>
    </PublicPageShell>
  );
}
