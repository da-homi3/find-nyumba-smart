import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/SiteNav";

export function LegalLayout({
  title,
  effectiveDate,
  children,
}: Readonly<{
  title: string;
  effectiveDate: string;
  children: ReactNode;
}>) {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Legal</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective: {effectiveDate}</p>
        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">{children}</div>
        <p className="mt-12 border-t pt-6 text-xs text-muted-foreground">
          Questions?{" "}
          <a href="mailto:hello@nyumbasearch.com" className="text-primary hover:underline">
            hello@nyumbasearch.com
          </a>
          {" · "}
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </main>
    </PublicPageShell>
  );
}

export function LegalSection({
  title,
  children,
  id,
}: Readonly<{ title: string; children: ReactNode; id?: string }>) {
  return (
    <section id={id}>
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
