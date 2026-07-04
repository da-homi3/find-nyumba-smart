import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /landlord/properties, new, and $id/edit. */
export const Route = createFileRoute("/landlord/properties")({
  component: LandlordPropertiesLayout,
});

function LandlordPropertiesLayout() {
  return <Outlet />;
}
