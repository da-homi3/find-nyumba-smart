import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/tenant/messages")({
  component: MessagesLayout,
});

function MessagesLayout() {
  return <Outlet />;
}
