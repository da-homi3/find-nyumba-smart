import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { submitContactMessage } from "@/lib/api/contact.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — NyumbaSearch" }] }),
  component: ContactPage,
});

function ContactPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-5 py-4">
        <Link to="/" className="font-display text-lg font-semibold">
          ← NyumbaSearch
        </Link>
      </header>
      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="font-display text-3xl font-semibold">Contact us</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Questions about listings, verification, or landlord plans? We reply within 24 hours.
        </p>
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
              toast.error((err as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          <label className="block text-sm font-medium">
            Email
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
          WhatsApp support: +254 7XX XXX XXX (business hours)
        </p>
      </main>
    </div>
  );
}
