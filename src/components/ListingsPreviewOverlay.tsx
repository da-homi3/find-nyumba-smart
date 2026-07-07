import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ListingsPreviewOverlayProps = Readonly<{
  active: boolean;
  children: ReactNode;
  className?: string;
  message?: string;
  variant?: "section" | "card";
}>;

export function ListingsPreviewOverlay({
  active,
  children,
  className,
  message = "Real listings upload in process",
  variant = "section",
}: ListingsPreviewOverlayProps) {
  if (!active) return children;

  if (variant === "card") {
    return (
      <div className={cn("relative", className)}>
        <div aria-hidden className="pointer-events-none select-none blur-sm saturate-75">
          {children}
        </div>
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/15 p-2">
          <span className="rounded-lg border bg-background/95 px-2.5 py-1.5 text-center text-[10px] font-semibold leading-tight shadow-sm backdrop-blur-sm">
            {message}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div aria-hidden className="pointer-events-none select-none blur-md saturate-75">
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/25 p-4">
        <p className="max-w-sm rounded-2xl border bg-background/95 px-6 py-4 text-center font-display text-lg font-semibold leading-snug shadow-lg backdrop-blur-sm">
          {message}
        </p>
      </div>
    </div>
  );
}
