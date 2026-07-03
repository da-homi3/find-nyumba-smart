import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardSettingsLinkProps = Readonly<{
  variant?: "sidebar" | "header" | "icon" | "pill" | "header-dark";
  className?: string;
}>;

/** Consistent link to /settings from portal dashboards and shells. */
export function DashboardSettingsLink({ variant = "pill", className }: DashboardSettingsLinkProps) {
  if (variant === "icon") {
    return (
      <Link
        to="/settings"
        aria-label="Open settings"
        className={cn(
          "inline-flex rounded-lg p-2 text-background/80 transition hover:bg-background/10 hover:text-background",
          className,
        )}
      >
        <Settings className="h-5 w-5" />
      </Link>
    );
  }

  if (variant === "sidebar") {
    return (
      <Link
        to="/settings"
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-background/75 hover:bg-background/10",
          className,
        )}
      >
        <Settings className="h-4 w-4" /> Settings
      </Link>
    );
  }

  if (variant === "header-dark") {
    return (
      <Link
        to="/settings"
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-background/20 px-3 py-1.5 text-sm font-medium text-gold hover:bg-background/10",
          className,
        )}
      >
        <Settings className="h-4 w-4" /> Settings
      </Link>
    );
  }

  if (variant === "header") {
    return (
      <Link
        to="/settings"
        className={cn(
          "inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        <Settings className="h-4 w-4" /> Settings
      </Link>
    );
  }

  return (
    <Link
      to="/settings"
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary",
        className,
      )}
    >
      <Settings className="h-4 w-4" /> Settings
    </Link>
  );
}
