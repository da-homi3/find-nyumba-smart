import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/tenant/messages")({
  component: Messages,
});

function Messages() {
  return (
    <div className="mx-auto max-w-2xl px-5 pt-10">
      <h1 className="font-display text-2xl font-semibold">Messages</h1>
      <div className="mt-10 rounded-2xl border border-dashed p-10 text-center">
        <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">No conversations yet. Message a landlord from a property page to start.</p>
      </div>
    </div>
  );
}
