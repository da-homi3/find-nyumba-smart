import { Link } from "@tanstack/react-router";
import { BrandLogoLink } from "@/components/BrandLogo";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { portalNavTourAttr } from "@/lib/onboarding/portal-nav-tour";

type PortalNavItem = Readonly<{
  to: string;
  label: string;
}>;

type PortalMobileHeaderProps = Readonly<{
  portalLabel: string;
  nav: readonly PortalNavItem[];
}>;

/** Sticky mobile header for portal dashboards (sidebar hidden below lg). */
export function PortalMobileHeader({ portalLabel, nav }: PortalMobileHeaderProps) {
  return (
    <header className="portal-mobile-header sticky top-0 z-20 lg:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="portal-sidebar-logo inline-block">
            <BrandLogoLink to="/" logoClassName="h-6" />
          </div>
          <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-white/55">
            {portalLabel}
          </p>
        </div>
        <DashboardSettingsLink variant="icon" />
      </div>
      <nav
        className="flex gap-1 overflow-x-auto border-t border-white/10 px-3 py-2 text-xs"
        aria-label="Portal navigation"
      >
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            preload="intent"
            data-tour={portalNavTourAttr(item.to)}
            className="shrink-0 rounded-full px-3 py-1.5 font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            activeProps={{
              className:
                "shrink-0 rounded-full bg-primary/25 px-3 py-1.5 font-semibold text-white ring-1 ring-primary/40",
            }}
          >
            {item.label}
          </Link>
        ))}
        <Link
          to="/settings"
          className="shrink-0 rounded-full px-3 py-1.5 font-medium text-gold transition hover:bg-white/10"
          activeProps={{ className: "shrink-0 rounded-full bg-white/15 px-3 py-1.5 font-semibold text-gold" }}
        >
          Settings
        </Link>
      </nav>
    </header>
  );
}
