import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CustomerCareInfo } from "@/components/CustomerCareInfo";
import { PublicPageShell } from "@/components/SiteNav";
import { submitContactMessage } from "@/lib/api/contact.functions";
import { getSiteUrl } from "@/lib/site";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — NyumbaSearch" },
      {
        name: "description",
        content:
          "Reach NyumbaSearch customer care for help, assistance, and inquiries about listings, verification, or landlord plans.",
      },
      { property: "og:title", content: "Contact — NyumbaSearch" },
      { property: "og:url", content: `${getSiteUrl()}/contact` },
    ],
    links: [{ rel: "canonical", href: `${getSiteUrl()}/contact` }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-lg px-5 py-16">
        <h1 className="font-display text-3xl font-semibold">Contact us</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Questions about listings, verification, landlord plans, or your account? Our customer care
          team is here to help — we typically reply within 24 hours.
        </p>

        <CustomerCareInfo className="mt-8" />

        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              await submitContactMessage({ data: { email, message } });
              toast.success("Message sent — we'll get back to you soon.");
              setEmail("");
              setMessage("");
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setLoading(false);
            }
          }}
        >
          <label className="block text-sm font-medium">
            Your email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm font-medium">
            Message
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send message"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prefer email or phone? Use the customer care details above.{" "}
          <Link to="/about" className="text-primary hover:underline">
            About NyumbaSearch
          </Link>
        </p>
      </main>
    </PublicPageShell>
  );
}
