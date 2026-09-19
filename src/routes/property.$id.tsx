import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/property/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/tenant/property/$id",
      params: { id: params.id },
      replace: true,
    });
  },
});
