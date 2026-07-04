import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /advertise and /advertise/pay. */
export const Route = createFileRoute("/advertise")({
  component: AdvertiseLayout,
});

function AdvertiseLayout() {
  return <Outlet />;
}
