import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/manager/")({
  beforeLoad: () => {
    throw redirect({ to: "/manager/dashboard" });
  },
});
