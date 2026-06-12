import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { ChevronDown } from "lucide-react";

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

export function SiteNav({ variant = "light" }: Readonly<Props>) {
  const { user, signOut, isLandlord } = useAuth();
  const { isPlus } = useEntitlements();
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const isHero = variant === "hero";
  const textClass = isHero ? "text-background" : "text-foreground";
  const mutedClass = isHero ? "text-background/85" : "text-muted-foreground";

  return (
    <header
      className={
        isHero
          ? "absolute top-0 inset-x-0 z-30"
          : "sticky top-0 z-30 border-b bg-background/95 backdrop-blur"
      }
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">
        <Link to="/" className={`flex items-center gap-2 ${textClass}`}>
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold text-gold-foreground font-bold">
            N
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">NyumbaSearch</span>
        </Link>

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
            className={`hidden items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium md:inline-flex ${isHero ? "border-background/30 bg-background/10 text-background" : "border-border"}`}
          >
            Account
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
            className={`hidden rounded-full border px-4 py-2 text-sm font-medium md:inline-flex ${isHero ? "border-background/30 bg-background/10 text-background" : "border-border"}`}
          >
            Sign in
          </Link>
        )}

        <button
          type="button"
          className={`rounded-lg border px-3 py-2 text-sm md:hidden ${isHero ? "border-background/30 text-background" : ""}`}
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
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-5">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-gold text-gold-foreground font-bold">
              N
            </div>
            <span className="font-display text-lg font-semibold">NyumbaSearch</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            The trusted way to find a home in Nairobi — built for tenants and landlords, free of
            brokers.
          </p>
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
    <div className="min-h-screen bg-background">
      <SiteNav variant="light" />
      {children}
      <SiteFooter />
    </div>
  );
}
