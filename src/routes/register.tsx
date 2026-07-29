import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  ref: z.string().optional(),
});

export const Route = createFileRoute("/register")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/auth",
      search: { mode: "signup" as const, ref: search.ref },
    });
  },
  component: () => null,
});
