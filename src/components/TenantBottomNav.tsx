import { Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Home, Map, MessageCircle, Search, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { prefetchTenantSection } from "@/lib/tenant-section-prefetch";
import { cn } from "@/lib/utils";

const items: Array<{ to: string; label: string; icon: typeof Home; exact?: boolean }> = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/tenant", label: "Browse", icon: Search, exact: true },
  { to: "/tenant/map", label: "Map", icon: Map },
  { to: "/tenant/rent", label: "Rent", icon: Wallet },
  { to: "/tenant/messages", label: "Messages", icon: MessageCircle },
];

export function TenantBottomNav() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const warm = (to: string) => {
    prefetchTenantSection(queryClient, to, user?.id);
  };

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return pathname === to;
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <nav
      data-tour="tenant-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-30 md:hidden"
    >
      <div className="mx-2 mb-[max(0.35rem,env(safe-area-inset-bottom))] rounded-2xl border border-border/60 bg-background/75 shadow-[0_-8px_32px_rgba(17,24,39,0.12)] backdrop-blur-xl supports-backdrop-filter:bg-background/65">
        <div className="mx-auto flex max-w-2xl items-stretch justify-around px-1 py-1.5">
          {items.map((i) => {
            const active = isActive(i.to, i.exact);
            return (
              <Link
                key={i.to}
                to={i.to}
                preload="intent"
                activeOptions={{ exact: i.exact ?? false }}
                onMouseEnter={() => warm(i.to)}
                onTouchStart={() => warm(i.to)}
                onFocus={() => warm(i.to)}
                className={cn(
                  "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary font-semibold" : "text-muted-foreground",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="tenant-nav-pill"
                    className="absolute inset-1 rounded-xl bg-primary/12"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : null}
                <i.icon className="relative z-10 h-5 w-5" aria-hidden />
                <span className="relative z-10">{i.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
