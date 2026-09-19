import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/map")({
  beforeLoad: () => {
    throw redirect({ to: "/tenant/map", replace: true });
  },
});
