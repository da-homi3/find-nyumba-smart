import { Link } from "@tanstack/react-router";
import { Home, Map, Heart, MessageCircle, Search } from "lucide-react";

const items: Array<{ to: string; label: string; icon: typeof Home; exact?: boolean }> = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/tenant", label: "Browse", icon: Search },
  { to: "/tenant/map", label: "Map", icon: Map },
  { to: "/tenant/saved", label: "Saved", icon: Heart },
  { to: "/tenant/messages", label: "Messages", icon: MessageCircle },
];

export function TenantBottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            activeOptions={{ exact: i.exact ?? false }}
            className="group flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium text-muted-foreground"
            activeProps={{ className: "text-primary font-semibold" }}
          >
            <i.icon className="h-5 w-5" />
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
