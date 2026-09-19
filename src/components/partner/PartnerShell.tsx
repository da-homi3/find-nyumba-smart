import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  Inbox,
  BarChart3,
  FileText,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, type ReactNode } from "react";
import { BrandLogoLink } from "@/components/BrandLogo";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { PortalMobileHeader } from "@/components/dashboard/PortalMobileHeader";

const nav = [
  { to: "/partner", label: "Dashboard", icon: LayoutDashboard },
  { to: "/partner/onboarding", label: "Profile", icon: ClipboardList },
  { to: "/partner/properties", label: "Properties", icon: Building2 },
  { to: "/partner/leads", label: "Leads", icon: Inbox },
  { to: "/partner/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/partner/report", label: "Report", icon: FileText },
] as const;

const mobileNav = nav.map((n) => ({ to: n.to, label: n.label }));

export function PartnerShell({ children }: Readonly<{ children: ReactNode }>) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({
        to: "/auth",
        search: { redirect: "/partner", mode: "signin" },
        replace: true,
      });
    }
  }, [user, loading, navigate]);

  return (
    <div className="portal-shell flex">
      <aside className="portal-sidebar hidden w-64 shrink-0 flex-col lg:flex">
        <div className="px-4 py-6">
          <div className="portal-sidebar-logo">
            <BrandLogoLink to="/" logoClassName="h-7" />
          </div>
          <div className="mt-2 px-2 text-[10px] uppercase tracking-wider text-white/55">
            Pilot Partnership
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              preload="intent"
              className="portal-nav-link"
              activeOptions={{ exact: n.to === "/partner" }}
              activeProps={{ className: "portal-nav-link is-active" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 px-3 pb-6">
          <DashboardSettingsLink variant="sidebar" />
          <button type="button" onClick={signOut} className="portal-nav-link w-full">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <PortalMobileHeader portalLabel="Pilot Partnership" nav={mobileNav} />
        {children}
      </main>
    </div>
  );
}
