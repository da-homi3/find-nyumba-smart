import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Smartphone, Zap, Shield } from "lucide-react";

export const Route = createFileRoute("/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp listing agent — NyumbaSearch" },
      {
        name: "description",
        content:
          "List rental properties on NyumbaSearch by chatting on WhatsApp. Send photos, price, and location — our agent drafts your listing.",
      },
    ],
  }),
  component: WhatsAppPage,
});

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined;
const WA_LINK = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent("Hi NyumbaSearch, I want to list a property")}`
  : null;

function WhatsAppPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-12">
      <Link to="/" className="text-sm text-muted-foreground">
        ← Home
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#25D366]/15 text-[#25D366]">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">WhatsApp listing agent</h1>
          <p className="text-sm text-muted-foreground">List a home without opening the dashboard</p>
        </div>
      </div>

      <p className="mt-6 text-muted-foreground">
        Message our agent on WhatsApp. It walks you through photos, rent, neighborhood, and
        description — then creates a <strong>draft listing</strong> on your NyumbaSearch landlord
        account for review.
      </p>

      {WA_LINK ? (
        <a
          href={WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-4 text-base font-semibold text-white shadow-lg transition hover:brightness-105"
        >
          <Smartphone className="h-5 w-5" />
          Open in WhatsApp
        </a>
      ) : (
        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-900 dark:text-amber-100">
          WhatsApp listing is not configured yet. Set <code>VITE_WHATSAPP_NUMBER</code> in your
          environment, or list via{" "}
          <Link to="/landlord/properties/new" className="font-semibold text-primary">
            Add property
          </Link>
          .
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Feature
          icon={Zap}
          title="Fast capture"
          text="Send photos and basics in chat — no forms on a small screen."
        />
        <Feature
          icon={Shield}
          title="You stay in control"
          text="Listings start as drafts. Publish only after you review in the dashboard."
        />
        <Feature
          icon={MessageCircle}
          title="Kenya-first"
          text="Understands Nairobi neighborhoods and KES pricing."
        />
      </div>

      <section className="mt-10 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">How it works</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
          <li>Start a chat and say you want to list a property.</li>
          <li>Share up to 5 photos when prompted.</li>
          <li>Send monthly rent (KES), neighborhood, and a short description.</li>
          <li>Confirm the summary — we create a draft under your landlord account.</li>
          <li>
            Open{" "}
            <Link to="/landlord/properties" className="font-semibold text-primary">
              Properties
            </Link>{" "}
            to add amenities and publish.
          </li>
        </ol>
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Landlords: link your phone in{" "}
        <Link to="/settings" className="font-semibold text-primary">
          Settings
        </Link>{" "}
        so we can match WhatsApp messages to your account. Agencies can also use{" "}
        <Link to="/landlord/import" className="font-semibold text-primary">
          bulk CSV import
        </Link>{" "}
        or the{" "}
        <Link to="/landlord/integrations" className="font-semibold text-primary">
          REST API
        </Link>
        .
      </p>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: Readonly<{ icon: typeof Zap; title: string; text: string }>) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
