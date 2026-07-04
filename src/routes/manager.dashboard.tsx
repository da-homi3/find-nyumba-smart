import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /manager/dashboard, billing, and plan. */
export const Route = createFileRoute("/manager/dashboard")({
  component: ManagerDashboardLayout,
});

function ManagerDashboardLayout() {
  return <Outlet />;
}
