import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — NyumbaSearch" }] }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-5 py-4">
        <Link to="/" className="font-display text-lg font-semibold">
          ← NyumbaSearch
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="font-display text-4xl font-semibold">About NyumbaSearch</h1>
        <p className="mt-6 text-muted-foreground leading-relaxed">
          NyumbaSearch helps Nairobi renters find verified vacant homes without agent fees or scams.
          We layer property intelligence — water reliability, security, internet, commute — on every
          listing so you can decide before you visit.
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Landlords list directly, verify in stages, and message tenants in-platform. No middlemen,
          no hidden viewing fees.
        </p>
        <p className="mt-8 text-sm font-semibold text-primary">Made in Nairobi 🇰🇪</p>
      </main>
    </div>
  );
}
