import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createPortalBeforeLoad } from "@/lib/route-guards/create-portal-before-load";

/**
 * Shared portal guard (same pattern as landlord/agency).
 * Public entry: /caretaker (PIN sign-in). Dashboard requires caretaker role or session.
 * Future: migrate PIN-only to phone-OTP session for per-person revoke/audit.
 */
export const Route = createFileRoute("/caretaker")({
  beforeLoad: createPortalBeforeLoad("caretaker"),
  component: () => <Outlet />,
});
