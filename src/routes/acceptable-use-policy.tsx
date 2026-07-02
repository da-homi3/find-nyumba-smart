import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";
import { getSiteUrl } from "@/lib/site";

export const Route = createFileRoute("/acceptable-use-policy")({
  head: () => ({
    meta: [{ title: "Acceptable Use Policy — NyumbaSearch" }],
    links: [{ rel: "canonical", href: `${getSiteUrl()}/acceptable-use-policy` }],
  }),
  component: AupPage,
});

function AupPage() {
  return (
    <LegalLayout title="Acceptable Use Policy" effectiveDate="1 July 2026">
      <LegalSection title="Prohibited conduct">
        <ul className="list-disc space-y-2 pl-5">
          <li>Fraudulent, ghost, or already-rented listings</li>
          <li>Harassment, hate speech, or discriminatory housing practices</li>
          <li>Automated scraping without written permission</li>
          <li>Sharing account credentials or bypassing verification</li>
          <li>Activities violating Kenyan law including the Computer Misuse and Cybercrimes Act</li>
        </ul>
      </LegalSection>
      <LegalSection title="Enforcement">
        <p>
          Violations may result in listing removal, account suspension, or referral to authorities.
          Report abuse to hello@nyumbasearch.com.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
