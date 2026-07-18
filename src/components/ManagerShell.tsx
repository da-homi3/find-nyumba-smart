import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Inbox,
  Users,
  Settings,
  LogOut,
  Plus,
  Loader2,
  BarChart3,
  KeyRound,
  CreditCard,
  Upload,
  Plug,
  Crown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BrandLogoLink } from "@/components/BrandLogo";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { PortalMobileHeader } from "@/components/dashboard/PortalMobileHeader";
import { OnboardingTourHost } from "@/components/onboarding/OnboardingTourHost";
import { portalNavTourAttr } from "@/lib/onboarding/portal-nav-tour";
import { useOrgMembership } from "@/hooks/use-org-membership";
import { useEffect, type ReactNode } from "react";

const ownerNav = [
  { to: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/manager/properties", label: "Properties", icon: Building2 },
  { to: "/manager/import", label: "Bulk import", icon: Upload },
  { to: "/manager/integrations", label: "API & integrations", icon: Plug },
  { to: "/manager/leads", label: "Messages", icon: Inbox },
  { to: "/manager/caretakers", label: "Caretakers", icon: KeyRound },
  { to: "/manager/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/manager/team", label: "Team", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/manager/dashboard/plan", label: "Plan", icon: Crown },
  { to: "/manager/dashboard/billing", label: "Billing", icon: CreditCard },
] as const;

const memberNav = [
  { to: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/manager/properties", label: "Properties", icon: Building2 },
  { to: "/manager/leads", label: "Messages", icon: Inbox },
  { to: "/manager/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function ManagerShell({ children }: Readonly<{ children: ReactNode }>) {
  const { user, loading: authLoading, signOut } = useAuth();
  const {
    membership,
    isOwner,
    isMember,
    isPending,
    loading: membershipLoading,
  } = useOrgMembership();
  const navigate = useNavigate();
  const loading = authLoading || membershipLoading;
  // Full landlord-parity tools for owners and solo accounts; limited nav for staff.
  const nav = isMember ? memberNav : ownerNav;
  const mobileNav = nav.map((n) => ({ to: n.to, label: n.label }));

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/manager" });
  }, [user, authLoading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isPending || (membership && membership.isPending)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-secondary px-6 text-center">
        <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
          <BrandLogoLink to="/" logoClassName="h-7" />
        </div>
        <h1 className="font-display text-2xl font-semibold">Awaiting owner approval</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your property-manager team invite is pending. Check your email for sign-in instructions,
          then ask the owner to approve you on the Team page before you can access this dashboard.
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-xl border px-4 py-2 text-sm font-semibold"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-secondary">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-foreground text-background lg:flex">
        <div className="px-4 py-6">
          <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
            <BrandLogoLink to="/" logoClassName="h-7" />
          </div>
          <div className="mt-2 px-2 text-[10px] uppercase tracking-wider text-background/60">
            Property manager
            {isOwner ? " · Owner" : " · Team"}
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              preload="intent"
              data-tour={portalNavTourAttr(n.to)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-background/75 hover:bg-background/10 hover:text-background"
              activeProps={{ className: "bg-background/10 text-background font-semibold" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 px-3 pb-6">
          <Link
            to="/manager/properties/new"
            data-tour="portal-add-property"
            className="flex items-center justify-center gap-2 rounded-lg bg-gradient-gold px-3 py-2.5 text-sm font-semibold text-gold-foreground"
          >
            <Plus className="h-4 w-4" /> Add property
          </Link>
          <DashboardSettingsLink variant="sidebar" />
          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-background/75 hover:bg-background/10"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <PortalMobileHeader portalLabel="Property manager" nav={mobileNav} />
        {children}
      </main>
      <OnboardingTourHost tourId="manager-dashboard" />
    </div>
  );
}
