import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { ConversationThread } from "@/components/ConversationThread";
import { MessagingGate } from "@/components/MessagingGate";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { MessageCircle } from "lucide-react";
import { currentRedirectPath } from "@/lib/navigation";

export const Route = createFileRoute("/tenant/messages/$id")({
  component: ThreadPage,
});

function ThreadPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { isPlus } = useEntitlements();
  const location = useLocation();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Sign in to view this conversation.</p>
        <Link
          to="/auth"
          search={{ redirect: currentRedirectPath(location) }}
          className="mt-4 inline-block text-sm font-semibold text-primary"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pt-4">
      {isPlus ? (
        <ConversationThread inquiryId={id} backTo="/tenant/messages" />
      ) : (
        <MessagingGate>
          <span />
        </MessagingGate>
      )}
    </div>
  );
}
