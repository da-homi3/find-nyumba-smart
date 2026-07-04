import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /agency/properties, new, and $id/edit. */
export const Route = createFileRoute("/agency/properties")({
  component: AgencyPropertiesLayout,
});

function AgencyPropertiesLayout() {
  return <Outlet />;
}
