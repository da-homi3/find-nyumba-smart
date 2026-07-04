import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /landlord/dashboard, billing, and plan. */
export const Route = createFileRoute("/landlord/dashboard")({
  component: LandlordDashboardLayout,
});

function LandlordDashboardLayout() {
  return <Outlet />;
}
