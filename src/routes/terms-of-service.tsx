import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";
import { getSiteUrl } from "@/lib/site";

export const Route = createFileRoute("/terms-of-service")({
  head: () => ({
    meta: [{ title: "Terms of Service — NyumbaSearch" }],
    links: [{ rel: "canonical", href: `${getSiteUrl()}/terms-of-service` }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" effectiveDate="1 July 2026">
      <LegalSection title="1. Acceptance">
        <p>
          By using NyumbaSearch at nyumbasearch.com you agree to these Terms. If you do not agree,
          do not use the platform.
        </p>
      </LegalSection>
      <LegalSection title="2. Eligibility">
        <p>You must be at least 18 and able to enter contracts under Kenyan law.</p>
      </LegalSection>
      <LegalSection title="3. Tenants">
        <p>
          NyumbaSearch connects tenants with landlords; we are not a party to any tenancy agreement.
          Contact unlock fees are non-refundable once a landlord number is revealed. Free trial
          unlocks expire 14 days after registration.
        </p>
      </LegalSection>
      <LegalSection title="4. Landlords & agents">
        <p>
          You warrant authority to list each property. Listings must be accurate and available.
          Duplicate or fraudulent listings may be removed without notice.
        </p>
      </LegalSection>
      <LegalSection title="5. Payments">
        <p>
          Prices are in KES. Subscriptions may renew automatically. M-Pesa and card payments are
          processed by Safaricom and Pesapal respectively. See our{" "}
          <a href="/refund-policy" className="text-primary hover:underline">
            Refund Policy
          </a>
          {"."}
        </p>
      </LegalSection>
      <LegalSection title="6. Liability">
        <p>
          To the extent permitted by Kenyan law, NyumbaSearch is not liable for tenancy disputes or
          inaccurate third-party listing information. Total liability is limited to fees paid in the
          prior three months.
        </p>
      </LegalSection>
      <LegalSection title="7. Governing law">
        <p>These Terms are governed by the laws of Kenya.</p>
      </LegalSection>
    </LegalLayout>
  );
}
