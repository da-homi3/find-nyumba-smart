import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /auth and children (/auth/reset, /auth/pending). */
export const Route = createFileRoute("/auth")({
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
