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
  Gift,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BrandLogoLink } from "@/components/BrandLogo";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { PortalMobileHeader } from "@/components/dashboard/PortalMobileHeader";
import { OnboardingTourHost } from "@/components/onboarding/OnboardingTourHost";
import { portalNavTourAttr } from "@/lib/onboarding/portal-nav-tour";
import { useOrgMembership } from "@/hooks/use-org-membership";
import { PORTAL_PATHS } from "@/lib/portal-paths";
import { portalLabelForRole } from "@/lib/portal-labels";
import { useEffect, type ReactNode } from "react";

type OrgListerPortal = "agency" | "property_developer" | "agent";

const ORG_ENTRY_PATH: Record<OrgListerPortal, string> = {
  agency: "/agency",
  property_developer: "/developer",
  agent: "/agent",
};

type Props = Readonly<{
  portal: OrgListerPortal;
  children: ReactNode;
}>;

export function ListerOrgShell({ portal, children }: Props) {
  const paths = PORTAL_PATHS[portal];
  const label = portalLabelForRole(portal);
  const entryPath = ORG_ENTRY_PATH[portal];
  const tourId = "agency-dashboard" as const;

  const ownerNav = [
    { to: paths.dashboard, label: "Dashboard", icon: LayoutDashboard },
    { to: paths.properties, label: "Properties", icon: Building2 },
    { to: paths.import, label: "Bulk import", icon: Upload },
    { to: paths.integrations, label: "API & integrations", icon: Plug },
    { to: paths.leads, label: "Messages", icon: Inbox },
    { to: paths.caretakers, label: "Caretakers", icon: KeyRound },
    { to: paths.analytics, label: "Analytics", icon: BarChart3 },
    ...(paths.team ? [{ to: paths.team, label: "Team", icon: Users }] : []),
    { to: "/settings", label: "Settings", icon: Settings },
    { to: paths.plan, label: "Plan", icon: Crown },
    { to: paths.billing, label: "Billing", icon: CreditCard },
    { to: "/referrals", label: "Invite & earn", icon: Gift },
  ] as const;

  const memberNav = [
    { to: paths.dashboard, label: "Dashboard", icon: LayoutDashboard },
    { to: paths.properties, label: "Properties", icon: Building2 },
    { to: paths.leads, label: "Messages", icon: Inbox },
    { to: paths.analytics, label: "Analytics", icon: BarChart3 },
    { to: "/settings", label: "Settings", icon: Settings },
  ] as const;

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
  const nav = isMember ? memberNav : ownerNav;
  const mobileNav = nav.map((n) => ({ to: n.to, label: n.label }));

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: entryPath });
  }, [user, authLoading, navigate, entryPath]);

  if (loading && !user) {
    return (
      <div className="portal-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isPending || membership?.isPending) {
    return (
      <div className="portal-shell flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="portal-sidebar-logo">
          <BrandLogoLink to="/" logoClassName="h-7" />
        </div>
        <h1 className="font-display text-2xl font-semibold">Awaiting owner approval</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your {label.toLowerCase()} team invite is pending. Check your email for sign-in
          instructions, then ask the owner to approve you on the Team page before you can access
          this dashboard.
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
    <div className="portal-shell flex">
      <aside className="portal-sidebar hidden w-64 shrink-0 flex-col lg:flex">
        <div className="px-4 py-6">
          <div className="portal-sidebar-logo">
            <BrandLogoLink to="/" logoClassName="h-7" />
          </div>
          <div className="mt-2 px-2 text-[10px] uppercase tracking-wider text-white/55">
            {label} portal
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
              className="portal-nav-link"
              activeProps={{ className: "portal-nav-link is-active" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 px-3 pb-6">
          <Link
            to={paths.propertiesNew}
            data-tour="portal-add-property"
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-3 py-2.5 text-sm font-semibold text-gold-foreground shadow-soft transition active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Add property
          </Link>
          <DashboardSettingsLink variant="sidebar" />
          <button type="button" onClick={() => signOut()} className="portal-nav-link w-full">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <PortalMobileHeader portalLabel={`${label} portal`} nav={mobileNav} />
        {children}
      </main>
      <OnboardingTourHost tourId={tourId} />
    </div>
  );
}

export function DeveloperShell({ children }: Readonly<{ children: ReactNode }>) {
  return <ListerOrgShell portal="property_developer">{children}</ListerOrgShell>;
}

export function AgentShell({ children }: Readonly<{ children: ReactNode }>) {
  return <ListerOrgShell portal="agent">{children}</ListerOrgShell>;
}
