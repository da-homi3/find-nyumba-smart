import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/developer/properties")({
  component: () => <Outlet />,
});
