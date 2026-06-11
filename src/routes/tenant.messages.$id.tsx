import { createFileRoute, Link } from "@tanstack/react-router";
import { ConversationThread } from "@/components/ConversationThread";
import { useAuth } from "@/hooks/use-auth";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/tenant/messages/$id")({
  component: ThreadPage,
});

function ThreadPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Sign in to view this conversation.</p>
        <Link to="/auth" className="mt-4 inline-block text-sm font-semibold text-primary">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ConversationThread inquiryId={id} onBack={() => window.history.back()} />
    </div>
  );
}
