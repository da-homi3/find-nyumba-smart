import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/listings")({
  beforeLoad: () => {
    throw redirect({ to: "/tenant", replace: true });
  },
});
