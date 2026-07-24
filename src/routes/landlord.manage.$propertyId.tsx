import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/landlord/manage/$propertyId")({
  component: () => <Outlet />,
});
