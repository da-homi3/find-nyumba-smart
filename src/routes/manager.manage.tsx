import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/manager/manage")({
  component: () => <Outlet />,
});
