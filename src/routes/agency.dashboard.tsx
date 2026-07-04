import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /agency/dashboard, billing, and plan. */
export const Route = createFileRoute("/agency/dashboard")({
  component: AgencyDashboardLayout,
});

function AgencyDashboardLayout() {
  return <Outlet />;
}
