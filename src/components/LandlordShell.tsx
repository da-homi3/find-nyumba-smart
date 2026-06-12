import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Inbox,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  KeyRound,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, type ReactNode } from "react";

const nav = [
  { to: "/landlord/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/landlord/properties", label: "Properties", icon: Building2 },
  { to: "/landlord/leads", label: "Messages", icon: Inbox },
  { to: "/landlord/caretakers", label: "Caretakers", icon: KeyRound },
  { to: "/landlord/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/landlord/dashboard/plan", label: "Plan", icon: Settings },
  { to: "/landlord/dashboard/billing", label: "Billing", icon: CreditCard },
] as const;

export function LandlordShell({ children }: Readonly<{ children: ReactNode }>) {
  const { user, isLandlord, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/landlord" });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen bg-secondary">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-foreground text-background lg:flex">
        <div className="flex items-center gap-2 px-6 py-6">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-gold text-gold-foreground font-bold">
            N
          </div>
          <div>
            <div className="font-display text-sm font-semibold">NyumbaSearch</div>
            <div className="text-[10px] uppercase tracking-wider text-background/60">Landlord</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-background/75 hover:bg-background/10 hover:text-background"
              activeProps={{ className: "bg-background/10 text-background font-semibold" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 px-3 pb-6">
          <Link
            to="/landlord/properties/new"
            className="flex items-center justify-center gap-2 rounded-lg bg-gradient-gold px-3 py-2.5 text-sm font-semibold text-gold-foreground"
          >
            <Plus className="h-4 w-4" /> Add property
          </Link>
          <Link
            to="/settings"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-background/75 hover:bg-background/10"
          >
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-background/75 hover:bg-background/10"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        {!loading && user && !isLandlord && (
          <div className="border-b bg-gold/20 px-6 py-3 text-sm text-foreground">
            This account isn't registered as a landlord.{" "}
            <Link to="/landlord" className="font-semibold underline">
              Switch accounts
            </Link>
            .
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
