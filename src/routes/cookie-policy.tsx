import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";
import { getSiteUrl } from "@/lib/site";

export const Route = createFileRoute("/cookie-policy")({
  head: () => ({
    meta: [{ title: "Cookie Policy — NyumbaSearch" }],
    links: [{ rel: "canonical", href: `${getSiteUrl()}/cookie-policy` }],
  }),
  component: CookiePolicyPage,
});

function CookiePolicyPage() {
  return (
    <LegalLayout title="Cookie Policy" effectiveDate="1 July 2026">
      <LegalSection title="What are cookies?">
        <p>
          Cookies are small text files stored on your device. We use them for essential site
          function, optional analytics, and remembering preferences.
        </p>
      </LegalSection>
      <LegalSection title="Categories">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Necessary</strong> — session, security, consent
            (always on)
          </li>
          <li>
            <strong className="text-foreground">Analytics</strong> — usage patterns (opt-in)
          </li>
          <li>
            <strong className="text-foreground">Marketing</strong> — promotional emails (opt-in)
          </li>
          <li>
            <strong className="text-foreground">Preferences</strong> — saved filters (opt-in)
          </li>
        </ul>
      </LegalSection>
      <LegalSection title="Managing cookies" id="manage">
        <p>
          Use the cookie banner on first visit or clear cookies in your browser. You can also email
          privacy@nyumbasearch.com. See our{" "}
          <a href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </a>{" "}
          for data rights under the Kenya Data Protection Act 2019.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
