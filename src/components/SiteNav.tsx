import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useTheme } from "@/hooks/use-theme";
import { BrandLogoLink } from "@/components/BrandLogo";
import { CustomerCareInfo } from "@/components/CustomerCareInfo";
import { NotificationBellMenu } from "@/components/NotificationBellMenu";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { AppDownloadStickyBar, PLAY_STORE_URL } from "@/components/AppDownloadBanner";
import { ChevronDown, Moon, Sun } from "lucide-react";
import { PORTAL_HOME, resolveListerDashboardPath } from "@/lib/portal-guard";

const SERVICE_LINKS = [
  { to: "/verify", label: "Property verification" },
  { to: "/services", label: "Home services" },
  { to: "/services/movers", label: "Moving & relocation" },
  { to: "/finance", label: "Finance & mortgages" },
  { to: "/insurance", label: "Insurance" },
  { to: "/reports", label: "Market reports" },
];

type Props = {
  variant?: "hero" | "light";
};

function resolveGlassClass(isHero: boolean, scrolled: boolean): string {
  if (isHero) {
    return scrolled
      ? "bg-[rgba(14,15,20,0.88)] shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
      : "bg-[rgba(14,15,20,0.42)]";
  }
  return scrolled ? "bg-background/90 shadow-card" : "bg-background/75";
}

function headerShellClass(isHero: boolean): string {
  return isHero
    ? "fixed inset-x-4 z-50 mx-auto max-w-7xl rounded-2xl border border-white/12 backdrop-blur-2xl sm:inset-x-6 top-[max(1rem,env(safe-area-inset-top,0px),var(--android-safe-top,0px))]"
    : "sticky top-0 z-30 border-b border-border/60 backdrop-blur-2xl safe-area-pad-top";
}

function heroOutlineClass(isHero: boolean): string {
  return isHero ? "border-white/30 bg-white/10 text-white" : "border-border";
}

function buildMobileNavLinks(loggedIn: boolean) {
  const links = [
    { to: "/", label: "Home" },
    { to: "/tenant", label: "Search" },
    { to: "/tenant/map", label: "Map" },
    ...SERVICE_LINKS,
    { to: "/reports", label: "Resources" },
    { to: "/about", label: "About" },
    { to: "/pricing", label: "Pricing" },
    { to: "/referrals", label: "Invite & earn", auth: true },
    { to: "/settings", label: "Settings" },
  ];
  return loggedIn ? links : links.filter((l) => !("auth" in l));
}

export function SiteNav({ variant = "light" }: Readonly<Props>) {
  const {
    user,
    signOut,
    isLandlord,
    isManager,
    isAgency,
    roles,
    activePortal,
    pendingApplications,
  } = useAuth();
  const { isPlus } = useEntitlements();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isHero = variant === "hero";
  const textClass = isHero ? "text-white" : "text-foreground";
  const mutedClass = isHero ? "text-white/85" : "text-muted-foreground";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showStickyAppBar = pathname !== "/";

  const hasListerPortal = isLandlord || isManager || isAgency;
  const dashboardHref = hasListerPortal
    ? resolveListerDashboardPath({
        roles,
        activePortal,
        applications: pendingApplications,
      })
    : PORTAL_HOME.tenant;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const glassClass = resolveGlassClass(isHero, scrolled);

  const mobileNavLinks = buildMobileNavLinks(!!user);

  return (
    <>
    <motion.header
      initial={false}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className={headerShellClass(isHero)}
    >
      <div
        className={`flex items-center justify-between px-4 py-3 transition-colors sm:px-5 ${glassClass}`}
      >
        <BrandLogoLink className={textClass} logoClassName="h-9 sm:h-10" priority />

        <nav className={`hidden items-center gap-1 md:flex ${mutedClass}`}>
          <Link
            to="/"
            className="rounded-full px-3 py-2 text-sm font-medium transition hover:bg-white/10 hover:opacity-100"
          >
            Home
          </Link>
          <Link
            to="/tenant"
            className="rounded-full px-3 py-2 text-sm font-medium transition hover:bg-white/10 hover:opacity-100"
          >
            Search
          </Link>
          <Link
            to="/tenant/map"
            className="rounded-full px-3 py-2 text-sm font-medium transition hover:bg-white/10 hover:opacity-100"
          >
            Map
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setServicesOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium hover:opacity-80"
            >
              Services <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {servicesOpen && (
              <div className="absolute left-0 mt-1 w-56 rounded-xl border bg-background py-1 text-foreground shadow-elegant">
                {SERVICE_LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="block px-4 py-2 text-sm hover:bg-secondary"
                    onClick={() => setServicesOpen(false)}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link
            to="/reports"
            className="rounded-full px-3 py-2 text-sm font-medium hover:opacity-80"
          >
            Resources
          </Link>
          <Link
            to="/about"
            className="rounded-full px-3 py-2 text-sm font-medium hover:opacity-80"
          >
            About
          </Link>
          {user && (
            <>
              <Link
                to="/referrals"
                className="rounded-full px-3 py-2 text-sm font-medium hover:opacity-80"
              >
                Invite & earn
              </Link>
              <Link
                to="/settings"
                className="rounded-full px-3 py-2 text-sm font-medium hover:opacity-80"
              >
                Settings
              </Link>
            </>
          )}
          {hasListerPortal && (
            <Link
              to={dashboardHref as "/landlord/dashboard"}
              className="rounded-full px-3 py-2 text-sm font-medium hover:opacity-80"
            >
              Dashboard
            </Link>
          )}
        </nav>

        {user ? (
          <div className="hidden items-center gap-2 md:flex">
            <RoleSwitcher variant={isHero ? "hero" : "default"} />
            <NotificationBellMenu
              bellClassName={
                isHero
                  ? "border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  : undefined
              }
            />
            {isPlus ? (
              <span className="rounded-full bg-gradient-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground">
                Plus
              </span>
            ) : null}
            <Link
              to="/landlord/properties/new"
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-green transition hover:opacity-95"
            >
              List Property
            </Link>
          </div>
        ) : (
          <div className="hidden items-center gap-2 md:flex">
            <Link
              to="/auth"
              search={{ redirect: "/tenant" }}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${heroOutlineClass(isHero)}`}
            >
              Login
            </Link>
            <Link
              to="/auth"
              search={{ redirect: "/landlord/properties/new" }}
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-green transition hover:opacity-95"
            >
              List Property
            </Link>
          </div>
        )}

        <motion.button
          type="button"
          onClick={toggleTheme}
          whileHover={{ rotate: 180 }}
          whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.3 }}
          aria-label="Toggle theme"
          className={`hidden rounded-xl border p-2 md:inline-flex ${isHero ? "border-white/20 bg-white/10" : "border-border bg-secondary/50"}`}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </motion.button>

        <div className="flex items-center gap-2 md:hidden">
          {user ? <NotificationBellMenu /> : null}
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm ${isHero ? "border-white/30 text-white" : ""}`}
            onClick={() => setMenuOpen((o) => !o)}
          >
            Menu
          </button>
        </div>
      </div>
      {menuOpen && (
        <div
          className={`border-t px-5 py-3 md:hidden ${isHero ? "border-background/20 bg-foreground/95 text-background" : "bg-background"}`}
        >
          {mobileNavLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="block py-2 text-sm font-medium"
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <Link
              to="/landlord/properties/new"
              className="mt-2 block rounded-xl bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground"
              onClick={() => setMenuOpen(false)}
            >
              List Property
            </Link>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: "/landlord/properties/new" }}
              className="mt-2 block rounded-xl bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground"
              onClick={() => setMenuOpen(false)}
            >
              List Property
            </Link>
          )}
          {user ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="py-2 text-sm text-destructive"
            >
              Sign out
            </button>
          ) : (
            <Link to="/auth" search={{ redirect: "/tenant" }} className="block py-2 text-sm">
              Login
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              toggleTheme();
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 py-2 text-sm font-medium"
          >
            {isDark ? (
              <>
                <Sun className="h-4 w-4" /> Light mode
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" /> Dark mode
              </>
            )}
          </button>
        </div>
      )}
    </motion.header>
    {showStickyAppBar ? <AppDownloadStickyBar /> : null}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2 lg:col-span-2">
          <BrandLogoLink logoClassName="h-8" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            The trusted way to find a home in Nairobi — built for tenants and landlords, free of
            brokers.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background hover:opacity-90"
            >
              Get it on Google Play
            </a>
            <span className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground">
              App Store · Coming soon
            </span>
          </div>
          <CustomerCareInfo className="mt-5" layout="inline" />
        </div>
        <FooterCol
          title="Quick Links"
          links={[
            { to: "/", label: "Home" },
            { to: "/tenant", label: "Search" },
            { to: "/tenant/map", label: "Map" },
            { to: "/tenant/saved", label: "Saved" },
          ]}
        />
        <FooterCol
          title="Services"
          links={SERVICE_LINKS.map((l) => ({ to: l.to, label: l.label }))}
        />
        <FooterCol
          title="Resources"
          links={[
            { to: "/reports", label: "Market reports" },
            { to: "/pricing", label: "Plans & pricing" },
            { to: "/advertise", label: "Advertise with us" },
            { to: "/pricing#plus", label: "NyumbaSearch Plus" },
          ]}
        />
        <FooterCol
          title="Support"
          links={[
            { to: "/contact", label: "Contact" },
            { to: "/privacy", label: "Privacy policy" },
            { to: "/terms-of-service", label: "Terms of service" },
            { to: "/cookie-policy", label: "Cookie policy" },
            { to: "/refund-policy", label: "Refund policy" },
            { to: "/data-deletion", label: "Delete my data" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { to: "/about", label: "About" },
            { to: "/contact", label: "Contact" },
            { to: "/caretaker", label: "Caretaker sign in" },
          ]}
        />
      </div>
      <div className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} NyumbaSearch · Made in Nairobi
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: Readonly<{ title: string; links: { to: string; label: string }[] }>) {
  return (
    <div>
      <div className="font-display text-sm font-semibold">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {links.map((l) => (
          <li key={l.label}>
            {l.to.includes("#") ? (
              <a href={l.to} className="hover:text-primary">
                {l.label}
              </a>
            ) : (
              <Link to={l.to} className="hover:text-primary">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublicPageShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen overflow-x-clip bg-background pb-20 md:pb-0">
      <SiteNav variant="light" />
      {children}
      <SiteFooter />
    </div>
  );
}
