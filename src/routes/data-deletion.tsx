import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ChangeEvent, type SyntheticEvent } from "react";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";
import { getSiteUrl } from "@/lib/site";
import { useAuth } from "@/hooks/use-auth";

const DELETION_SUBJECT = "Data deletion request";
const CONTACT_EMAIL = "hello@nyumbasearch.com";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [{ title: "Data Deletion — NyumbaSearch" }],
    links: [{ rel: "canonical", href: `${getSiteUrl()}/data-deletion` }],
  }),
  component: DataDeletionPage,
});

function buildMailtoHref(email: string, message: string): string {
  const subject = encodeURIComponent(DELETION_SUBJECT);
  const bodyText = `Email: ${email}\n\n${message}`;
  const body = encodeURIComponent(bodyText);
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

function preventFormSubmit(event: SyntheticEvent<HTMLFormElement>) {
  event.preventDefault();
}

function makeEmailChangeHandler(onEmailChange: (value: string) => void) {
  function onEmailFieldChange(event: ChangeEvent<HTMLInputElement>) {
    onEmailChange(event.currentTarget.value);
  }
  return onEmailFieldChange;
}

function makeMessageChangeHandler(onMessageChange: (value: string) => void) {
  function onMessageFieldChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onMessageChange(event.currentTarget.value);
  }
  return onMessageFieldChange;
}

function DeletionRequestForm({
  email,
  message,
  onEmailChange,
  onMessageChange,
}: Readonly<{
  email: string;
  message: string;
  onEmailChange: (value: string) => void;
  onMessageChange: (value: string) => void;
}>) {
  const mailtoHref = buildMailtoHref(email, message);
  const handleEmailChange = makeEmailChangeHandler(onEmailChange);
  const handleMessageChange = makeMessageChangeHandler(onMessageChange);

  return (
    <form className="mt-4 space-y-3 rounded-xl border bg-card p-4" onSubmit={preventFormSubmit}>
      <label htmlFor="deletion-email" className="block text-sm">
        <span className="font-medium text-foreground">Your email</span>
        <input
          id="deletion-email"
          type="email"
          required
          value={email}
          onChange={handleEmailChange}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
        />
      </label>
      <label htmlFor="deletion-details" className="block text-sm">
        <span className="font-medium text-foreground">Additional details (optional)</span>
        <textarea
          id="deletion-details"
          value={message}
          onChange={handleMessageChange}
          rows={3}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
        />
      </label>
      <a
        href={mailtoHref}
        className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Send deletion request
      </a>
    </form>
  );
}

function DataDeletionPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [message, setMessage] = useState("");

  return (
    <LegalLayout title="Data Deletion" effectiveDate="1 July 2026">
      <LegalSection title="Your rights">
        <p>
          Under the Kenya Data Protection Act 2019 you may request deletion or export of your
          personal data. Meta/WhatsApp integrations: use this page URL in your app settings.
        </p>
      </LegalSection>
      <LegalSection title="Request deletion">
        <p>
          Email {CONTACT_EMAIL} with subject line &quot;{DELETION_SUBJECT}&quot; and include:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Full name and account email or phone</li>
          <li>Whether you are a tenant, landlord, or other user type</li>
          <li>What you want deleted (full account or specific data)</li>
        </ul>
        <p className="mt-3">
          Signed-in users can also delete their account from{" "}
          <Link to="/settings" className="text-primary hover:underline">
            Settings
          </Link>
          {"."}
        </p>
        <DeletionRequestForm
          email={email}
          message={message}
          onEmailChange={setEmail}
          onMessageChange={setMessage}
        />
      </LegalSection>
      <LegalSection title="Timeline">
        <p>We process verified requests within 30 days, except where law requires retention.</p>
      </LegalSection>
    </LegalLayout>
  );
}
