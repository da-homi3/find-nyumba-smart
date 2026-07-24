import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/agency/manage")({
  component: () => <Outlet />,
});
