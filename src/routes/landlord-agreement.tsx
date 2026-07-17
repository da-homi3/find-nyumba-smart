import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";
import { getSiteUrl } from "@/lib/site";

export const Route = createFileRoute("/landlord-agreement")({
  head: () => ({
    meta: [{ title: "Landlord Agreement — NyumbaSearch" }],
    links: [{ rel: "canonical", href: `${getSiteUrl()}/landlord-agreement` }],
  }),
  component: LandlordAgreementPage,
});

function LandlordAgreementPage() {
  return (
    <LegalLayout title="Landlord Listing Agreement" effectiveDate="1 July 2026">
      <LegalSection title="By listing on NyumbaSearch you agree to">
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide accurate property details, photos, rent, and availability</li>
          <li>Update status promptly when a unit is rented</li>
          <li>Supply a working contact number for verified unlocks</li>
          <li>Not duplicate the same property across multiple accounts</li>
          <li>Deal with tenants as a verified property owner (no intermediary markups) when they found you via NyumbaSearch</li>
          <li>Cooperate with listing verification when requested</li>
        </ul>
      </LegalSection>
      <LegalSection title="Removals">
        <p>
          NyumbaSearch may remove listings that breach these terms or our{" "}
          <a href="/acceptable-use-policy" className="text-primary hover:underline">
            Acceptable Use Policy
          </a>
          {"."}
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
