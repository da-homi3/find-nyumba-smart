import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/agency/")({
  beforeLoad: () => {
    throw redirect({ to: "/agency/dashboard" });
  },
});
