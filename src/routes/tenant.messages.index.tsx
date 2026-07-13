import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/EmptyState";
import { listTenantInquiries } from "@/lib/api/nyumba.functions";
import { useAuth } from "@/hooks/use-auth";
import { formatKes } from "@/lib/properties";
import { countUnread } from "@/lib/conversation-utils";
import { currentRedirectPath } from "@/lib/navigation";
import { errorMessage } from "@/lib/utils";
import { MessagingGate } from "@/components/MessagingGate";
import { PropertyImage } from "@/components/PropertyImage";
import { SiteNav } from "@/components/SiteNav";
import { PlusUpsellBanner } from "@/components/PlusUpsellBanner";
import { useEntitlements } from "@/hooks/use-entitlements";
import { OnboardingTourHost } from "@/components/onboarding/OnboardingTourHost";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/tenant/messages/")({
  head: () => ({ meta: [{ title: "Messages — NyumbaSearch" }] }),
  component: Messages,
});

function Messages() {
  const { user, loading } = useAuth();
  const { isPlus } = useEntitlements();
  const location = useLocation();
  const {
    data: inquiries = [],
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["tenant-inquiries", user?.id],
    enabled: !!user,
    queryFn: () => listTenantInquiries(),
  });

  if (loading) {
    return (
      <div>
        <SiteNav variant="light" />
        <div className="mx-auto max-w-2xl px-5 pt-6 pb-24 md:pb-8">
          <div className="h-8 w-36 animate-pulse rounded-lg bg-muted" />
          <div className="mt-8 grid gap-3">
            {["msg-sk-a", "msg-sk-b", "msg-sk-c"].map((id) => (
              <div key={id} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <SiteNav variant="light" />
        <div className="mx-auto max-w-md px-6 pt-16 pb-24 text-center md:pb-16">
          <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Message landlords</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to keep all your property conversations in one place.
          </p>
          <Link
            to="/auth"
            search={{ redirect: currentRedirectPath(location) }}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SiteNav variant="light" />
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-24 md:pb-8">
        <h1 className="font-display text-2xl font-semibold">Messages</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${inquiries.length} conversations`}
        </p>

        {!isPlus && (
          <div className="mt-4">
            <PlusUpsellBanner
              dismissKey="messages-inbox"
              title="Reply to landlords with Plus"
              body="View your inbox anytime. Sending new messages requires NyumbaSearch Plus."
            />
          </div>
        )}

        <div data-tour="tenant-messages-list">
          <MessagesInbox
            inquiries={inquiries}
            userId={user.id}
            isPlus={isPlus}
            isLoading={isLoading}
            error={error}
            onRetry={() => void refetch()}
          />
        </div>
        <OnboardingTourHost tourId="tenant-messages" />
      </div>
    </div>
  );
}

type InquiryItem = Awaited<ReturnType<typeof listTenantInquiries>>[number];

function MessagesInbox({
  inquiries,
  userId,
  isPlus,
  isLoading,
  error,
  onRetry,
}: Readonly<{
  inquiries: InquiryItem[];
  userId: string;
  isPlus: boolean;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}>) {
  if (!isPlus && inquiries.length === 0) {
    return (
      <div className="mt-6">
        <MessagingGate>
          <span />
        </MessagingGate>
      </div>
    );
  }

  return (
    <MessagesBody
      inquiries={inquiries}
      userId={userId}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      readOnly={!isPlus}
    />
  );
}

function MessagesBody({
  inquiries,
  userId,
  isLoading,
  error,
  onRetry,
  readOnly = false,
}: Readonly<{
  inquiries: InquiryItem[];
  userId: string;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  readOnly?: boolean;
}>) {
  if (isLoading) {
    return (
      <div className="mt-8 grid gap-3">
        {["msg-sk-1", "msg-sk-2", "msg-sk-3"].map((id) => (
          <div key={id} className="h-28 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-10 rounded-2xl border border-destructive/30 p-6 text-center">
        <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-destructive">Messages did not load.</p>
        <p className="mt-1 text-xs text-muted-foreground">{errorMessage(error)}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  if (inquiries.length === 0) {
    return <EmptyState type="no_messages" className="mt-10" />;
  }

  return (
    <div className="mt-6 grid gap-3">
      {inquiries.map((inquiry) => {
        const unread = countUnread(inquiry.inquiry_messages, userId);
        const last =
          inquiry.inquiry_messages?.[inquiry.inquiry_messages.length - 1]?.body ?? inquiry.message;
        const cover = inquiry.properties?.images?.[0];
        return (
          <Link
            key={inquiry.id}
            to="/tenant/messages/$id"
            params={{ id: inquiry.id }}
            className="block min-h-11 rounded-2xl border bg-card p-4 shadow-soft transition hover:border-primary/30 active:bg-secondary/40"
          >
            <article>
              <div className="flex items-start gap-3">
                {cover && (
                  <PropertyImage
                    src={cover}
                    seed={`${inquiry.id}-cover`}
                    alt={inquiry.properties?.title ?? "Listing"}
                    className="h-16 w-20 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="line-clamp-1 font-display font-semibold">
                      {inquiry.properties?.title ?? "Listing"}
                    </h2>
                    {unread > 0 && (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                        {unread}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {inquiry.profiles?.full_name ?? "Landlord"} ·{" "}
                    {inquiry.properties
                      ? `${inquiry.properties.neighborhood} · ${formatKes(inquiry.properties.rent_kes)}`
                      : "Nairobi"}
                  </p>
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{last}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{new Date(inquiry.updated_at).toLocaleDateString()}</span>
                    {readOnly ? <span className="text-gold">Plus required to reply</span> : null}
                  </div>
                </div>
              </div>
            </article>
          </Link>
        );
      })}
    </div>
  );
}
