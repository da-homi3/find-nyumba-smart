import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /verify, /verify/request, and /verify/status/$requestId. */
export const Route = createFileRoute("/verify")({
  component: VerifyLayout,
});

function VerifyLayout() {
  return <Outlet />;
}
