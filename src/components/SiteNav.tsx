import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useTheme } from "@/hooks/use-theme";
import { BrandLogoLink } from "@/components/BrandLogo";
import { CustomerCareInfo } from "@/components/CustomerCareInfo";
import { ChevronDown, Moon, Sun } from "lucide-react";

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
      ? "bg-[rgba(13,17,23,0.9)] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      : "bg-[rgba(13,17,23,0.4)]";
  }
  return scrolled ? "bg-background/95 shadow-card" : "bg-background/80";
}

function headerShellClass(isHero: boolean): string {
  return isHero
    ? "fixed top-4 inset-x-4 z-50 mx-auto max-w-7xl rounded-2xl border border-white/10 backdrop-blur-xl sm:inset-x-6"
    : "sticky top-0 z-30 border-b backdrop-blur-xl";
}

function heroOutlineClass(isHero: boolean): string {
  return isHero ? "border-white/30 bg-white/10 text-white" : "border-border";
}

export function SiteNav({ variant = "light" }: Readonly<Props>) {
  const { user, signOut, isLandlord } = useAuth();
  const { isPlus } = useEntitlements();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isHero = variant === "hero";
  const textClass = isHero ? "text-white" : "text-foreground";
  const mutedClass = isHero ? "text-white/85" : "text-muted-foreground";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const glassClass = resolveGlassClass(isHero, scrolled);

  return (
    <motion.header
      initial={false}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className={headerShellClass(isHero)}
    >
      <div
        className={`flex items-center justify-between px-4 py-3 transition-colors sm:px-5 ${glassClass}`}
      >
        <BrandLogoLink className={textClass} logoClassName="h-9 sm:h-10" />

        <nav className={`hidden items-center gap-1 md:flex ${mutedClass}`}>
          <Link
            to="/tenant"
            className="rounded-full px-3 py-2 text-sm font-medium hover:opacity-80"
          >
            Browse
          </Link>
          <Link
            to="/tenant/map"
            className="rounded-full px-3 py-2 text-sm font-medium hover:opacity-80"
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
            to="/pricing"
            className="rounded-full px-3 py-2 text-sm font-medium hover:opacity-80"
          >
            Pricing
          </Link>
          {user && (
            <Link
              to="/settings"
              className="rounded-full px-3 py-2 text-sm font-medium hover:opacity-80"
            >
              Settings
            </Link>
          )}
          {isLandlord && (
            <Link
              to="/landlord/dashboard"
              className="rounded-full px-3 py-2 text-sm font-medium hover:opacity-80"
            >
              Dashboard
            </Link>
          )}
        </nav>

        {user ? (
          <Link
            to="/settings"
            className={`hidden items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium md:inline-flex ${heroOutlineClass(isHero)}`}
          >
            Settings
            {isPlus && (
              <span className="rounded-full bg-gradient-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground">
                Plus
              </span>
            )}
          </Link>
        ) : (
          <Link
            to="/auth"
            search={{ redirect: "/tenant" }}
            className={`hidden rounded-full border px-4 py-2 text-sm font-medium md:inline-flex ${heroOutlineClass(isHero)}`}
          >
            Sign in
          </Link>
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

        <button
          type="button"
          className={`rounded-lg border px-3 py-2 text-sm md:hidden ${isHero ? "border-white/30 text-white" : ""}`}
          onClick={() => setMenuOpen((o) => !o)}
        >
          Menu
        </button>
      </div>
      {menuOpen && (
        <div
          className={`border-t px-5 py-3 md:hidden ${isHero ? "border-background/20 bg-foreground/95 text-background" : "bg-background"}`}
        >
          {[
            ...SERVICE_LINKS,
            { to: "/pricing", label: "Pricing" },
            { to: "/tenant", label: "Browse" },
            { to: "/tenant/map", label: "Map" },
            { to: "/settings", label: "Settings" },
          ].map((l) => (
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
            <button
              type="button"
              onClick={() => signOut()}
              className="py-2 text-sm text-destructive"
            >
              Sign out
            </button>
          ) : (
            <Link to="/auth" search={{ redirect: "/tenant" }} className="block py-2 text-sm">
              Sign in
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
          <CustomerCareInfo className="mt-5" layout="inline" />
        </div>
        <FooterCol
          title="Tenants"
          links={[
            { to: "/tenant", label: "Browse homes" },
            { to: "/tenant/map", label: "Map view" },
            { to: "/tenant/saved", label: "Saved" },
          ]}
        />
        <FooterCol
          title="Services"
          links={SERVICE_LINKS.map((l) => ({ to: l.to, label: l.label }))}
        />
        <FooterCol
          title="Pricing"
          links={[
            { to: "/pricing", label: "Landlord plans" },
            { to: "/pricing#agencies", label: "Agency plans" },
            { to: "/pricing#plus", label: "NyumbaSearch Plus" },
            { to: "/pricing#boost", label: "Boost a listing" },
            { to: "/advertise", label: "Advertise with us" },
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            { to: "/privacy", label: "Privacy policy" },
            { to: "/terms-of-service", label: "Terms of service" },
            { to: "/cookie-policy", label: "Cookie policy" },
            { to: "/acceptable-use-policy", label: "Acceptable use" },
            { to: "/refund-policy", label: "Refund policy" },
            { to: "/data-deletion", label: "Delete my data" },
            { to: "/landlord-agreement", label: "Landlord agreement" },
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
    <div className="min-h-screen overflow-x-clip bg-background">
      <SiteNav variant="light" />
      {children}
      <SiteFooter />
    </div>
  );
}
