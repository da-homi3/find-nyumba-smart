import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PublicPageShell } from "@/components/SiteNav";
import { getSiteUrl } from "@/lib/site";

const CONTACT_EMAIL = "hello@nyumbasearch.com";
const LAST_UPDATED = "1 July 2026";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — NyumbaSearch" },
      {
        name: "description",
        content:
          "How NyumbaSearch collects, uses, and protects your personal data when you browse listings, create an account, or message us on WhatsApp.",
      },
      { property: "og:title", content: "Privacy Policy — NyumbaSearch" },
      { property: "og:url", content: `${getSiteUrl()}/privacy` },
    ],
    links: [{ rel: "canonical", href: `${getSiteUrl()}/privacy` }],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Legal</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED} ·{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>

        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          NyumbaSearch (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates{" "}
          <a href={getSiteUrl()} className="text-primary hover:underline">
            nyumbasearch.com
          </a>{" "}
          — a property search and landlord–tenant platform focused on Nairobi, Kenya. This policy
          explains what personal data we collect, why we collect it, and the choices you have.
        </p>

        <Section title="1. Who this applies to">
          <p>
            This policy applies to tenants, landlords, property managers, agencies, caretakers, and
            service providers who use our website, WhatsApp assistant, or related services. If you
            use NyumbaSearch on behalf of a business, you confirm you have authority to share that
            business&apos;s data with us.
          </p>
        </Section>

        <Section title="2. Data we collect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Account data:</strong> name, email address, phone
              number, password (stored hashed), and profile preferences.
            </li>
            <li>
              <strong className="text-foreground">Listing &amp; inquiry data:</strong> property
              details, photos, messages between tenants and landlords, viewing requests, and saved
              searches.
            </li>
            <li>
              <strong className="text-foreground">Payment data:</strong> M-Pesa phone number,
              transaction references, and plan metadata. We do not store full card numbers; card
              payments are processed by our payment partners.
            </li>
            <li>
              <strong className="text-foreground">WhatsApp &amp; messaging:</strong> if you contact
              us via WhatsApp or our Meta-integrated channels, we receive your phone number, message
              content, and delivery metadata needed to respond and improve the service.
            </li>
            <li>
              <strong className="text-foreground">Technical data:</strong> IP address, browser
              type, device information, pages visited, and cookies or similar identifiers used for
              security, analytics, and session management.
            </li>
          </ul>
        </Section>

        <Section title="3. How we use your data">
          <ul className="list-disc space-y-2 pl-5">
            <li>Provide search, listings, messaging, bookings, and account features.</li>
            <li>Verify listings and reduce fraud on the platform.</li>
            <li>Process subscriptions, boosts, and other paid products.</li>
            <li>Send transactional messages (e.g. viewing confirmations, password resets).</li>
            <li>
              Send marketing emails only where you have opted in; you may unsubscribe at any time.
            </li>
            <li>Comply with law, enforce our terms, and protect users and the platform.</li>
          </ul>
        </Section>

        <Section title="4. Legal bases (where applicable)">
          <p>
            We process personal data based on: (a) performance of a contract when you use our
            services; (b) legitimate interests such as security, analytics, and product improvement;
            (c) consent where required (e.g. marketing); and (d) legal obligations.
          </p>
        </Section>

        <Section title="5. Sharing with third parties">
          <p>We may share data with:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Infrastructure providers</strong> (e.g. hosting,
              database, email) under data-processing agreements.
            </li>
            <li>
              <strong className="text-foreground">Payment processors</strong> (M-Pesa, Pesapal, and
              similar) to complete transactions you initiate.
            </li>
            <li>
              <strong className="text-foreground">Meta / WhatsApp</strong> when you use our
              WhatsApp or social integrations — governed also by Meta&apos;s policies.
            </li>
            <li>
              <strong className="text-foreground">Law enforcement or regulators</strong> when
              required by applicable law.
            </li>
          </ul>
          <p>We do not sell your personal data.</p>
        </Section>

        <Section title="6. International transfers">
          <p>
            Our service providers may process data outside Kenya (including the EU and United States).
            Where required, we use appropriate safeguards such as standard contractual clauses or
            equivalent mechanisms.
          </p>
        </Section>

        <Section title="7. Retention">
          <p>
            We keep personal data only as long as needed for the purposes above, including legal,
            accounting, and dispute-resolution requirements. Inactive accounts and stale inquiry
            data may be deleted or anonymised after a reasonable period.
          </p>
        </Section>

        <Section title="8. Your rights">
          <p>
            Depending on your location, you may have the right to access, correct, delete, restrict,
            or port your personal data, and to object to certain processing. To exercise these
            To exercise these rights, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>{" "}
            and we will respond within a reasonable time.
          </p>
        </Section>

        <Section title="9. Cookies">
          <p>
            We use essential cookies for authentication and security, and optional analytics to
            understand how the site is used. You can control non-essential cookies through your
            browser settings.
          </p>
        </Section>

        <Section title="10. Children">
          <p>
            NyumbaSearch is not directed at children under 18. We do not knowingly collect data
            from minors. Contact us if you believe a child has provided personal data.
          </p>
        </Section>

        <section id="data-deletion" className="mt-10 scroll-mt-24">
          <h2 className="font-display text-xl font-semibold">11. Data deletion (Meta / WhatsApp)</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              If you connected NyumbaSearch through Facebook, Instagram, Threads, or WhatsApp and
              want your data removed:
            </p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Email{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                  {CONTACT_EMAIL}
                </a>{" "}
                from the address or phone linked to your account with the subject line{" "}
                <strong className="text-foreground">Data deletion request</strong>.
              </li>
              <li>
                Include your full name, phone number, and whether you are a tenant, landlord, or
                other user type.
              </li>
              <li>
                We will delete or anonymise personal data within 30 days, except where we must
                retain records for legal, fraud-prevention, or accounting purposes.
              </li>
            </ol>
            <p>
              You may also delete your account from{" "}
              <Link to="/settings" className="text-primary hover:underline">
                Settings
              </Link>{" "}
              when signed in.
            </p>
          </div>
        </section>

        <Section title="12. Changes">
          <p>
            We may update this policy from time to time. The &quot;Last updated&quot; date at the
            top will change when we do. Continued use of NyumbaSearch after changes constitutes
            acceptance of the updated policy.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            NyumbaSearch · Nairobi, Kenya
            <br />
            Email:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
            <br />
            Web:{" "}
            <Link to="/contact" className="text-primary hover:underline">
              Contact form
            </Link>
          </p>
        </Section>
      </main>
    </PublicPageShell>
  );
}
