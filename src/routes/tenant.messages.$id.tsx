import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { ConversationThread } from "@/components/ConversationThread";
import { useAuth } from "@/hooks/use-auth";
import { MessageCircle } from "lucide-react";
import { currentRedirectPath } from "@/lib/navigation";

export const Route = createFileRoute("/tenant/messages/$id")({
  head: () => ({ meta: [{ title: "Conversation — NyumbaSearch" }] }),
  component: ThreadPage,
});

function ThreadPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background px-6">
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Sign in to view this conversation.</p>
        <Link
          to="/auth"
          search={{ redirect: currentRedirectPath(location) }}
          className="mt-4 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return <ConversationThread inquiryId={id} backTo="/tenant/messages" fullHeight />;
}
