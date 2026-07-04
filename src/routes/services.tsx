import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /services and all child routes (category, provider, register). */
export const Route = createFileRoute("/services")({
  component: ServicesLayout,
});

function ServicesLayout() {
  return <Outlet />;
}
