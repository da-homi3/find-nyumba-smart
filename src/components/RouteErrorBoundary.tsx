import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { ReactNode } from "react";

export function RouteErrorBoundary({
  children,
  title = "Something went wrong",
}: Readonly<{ children: ReactNode; title?: string }>) {
  return <ErrorBoundary fallbackTitle={title}>{children}</ErrorBoundary>;
}
