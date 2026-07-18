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
    <header className="sticky top-0 z-20 border-b bg-foreground text-background lg:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="rounded-lg bg-white px-2 py-1 shadow-sm">
            <BrandLogoLink to="/" logoClassName="h-6" />
          </div>
          <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-background/60">
            {portalLabel}
          </p>
        </div>
        <DashboardSettingsLink variant="icon" />
      </div>
      <nav
        className="flex gap-1 overflow-x-auto border-t border-background/10 px-3 py-2 text-xs"
        aria-label="Portal navigation"
      >
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            preload="intent"
            data-tour={portalNavTourAttr(item.to)}
            className="shrink-0 rounded-full px-3 py-1.5 font-medium text-background/75 hover:bg-background/10 hover:text-background"
            activeProps={{
              className: "bg-background/15 text-background font-semibold",
            }}
          >
            {item.label}
          </Link>
        ))}
        <Link
          to="/settings"
          className="shrink-0 rounded-full px-3 py-1.5 font-medium text-gold hover:bg-background/10"
          activeProps={{ className: "bg-background/15 font-semibold" }}
        >
          Settings
        </Link>
      </nav>
    </header>
  );
}
