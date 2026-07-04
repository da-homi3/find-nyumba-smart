import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /manager/properties, new, and $id/edit. */
export const Route = createFileRoute("/manager/properties")({
  component: ManagerPropertiesLayout,
});

function ManagerPropertiesLayout() {
  return <Outlet />;
}
