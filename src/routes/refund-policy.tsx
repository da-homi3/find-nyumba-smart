import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";
import { getSiteUrl, CUSTOMER_CARE_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [{ title: "Refund Policy — NyumbaSearch" }],
    links: [{ rel: "canonical", href: `${getSiteUrl()}/refund-policy` }],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <LegalLayout title="Refund Policy" effectiveDate="1 July 2026">
      <LegalSection title="Contact unlocks">
        <p>Non-refundable once the landlord contact number is displayed.</p>
      </LegalSection>
      <LegalSection title="Subscriptions">
        <p>
          Pro-rated refunds within 7 days of first charge only if the paid features were not used.
          Cancel anytime; access continues until period end.
        </p>
      </LegalSection>
      <LegalSection title="M-Pesa & card">
        <p>
          Approved refunds are reversed to the original M-Pesa number within 5 business days. Card
          refunds via Pesapal may take 5–10 business days.
        </p>
      </LegalSection>
      <LegalSection title="How to request">
        <p>Email {CUSTOMER_CARE_EMAIL} with your account email, payment reference, and reason.</p>
      </LegalSection>
    </LegalLayout>
  );
}
