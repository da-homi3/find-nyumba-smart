import { useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { PORTAL_HOME, type PortalId } from "@/lib/portal-guard";

const ROLE_LABELS: Partial<Record<AppRole, string>> = {
  tenant: "Tenant",
  landlord: "Landlord",
  agency: "Agency",
  manager: "Property Manager",
  caretaker: "Caretaker",
  admin: "Admin",
};

function portalForSwitchRole(role: AppRole): PortalId | null {
  if (role === "tenant") return "tenant";
  if (role === "landlord") return "landlord";
  if (role === "agency") return "agency";
  if (role === "manager") return "manager";
  if (role === "caretaker") return "caretaker";
  if (role === "admin") return "admin";
  return null;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Could not switch portal";
}

type RoleSwitcherProps = Readonly<{
  /** Hero nav uses light-on-dark chips. */
  variant?: "default" | "hero";
  className?: string;
}>;

/**
 * Shown only when the account has 2+ switchable roles.
 * Does not grant roles — “Add another role” opens the existing apply flow.
 */
export function RoleSwitcher({ variant = "default", className = "" }: RoleSwitcherProps) {
  const { roles, activePortal, setActivePortalChoice, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const switchable = roles.filter((r) => ROLE_LABELS[r] && (r !== "admin" || isAdmin));
  // Include tenant implicitly for browse accounts that only have tenant (or empty → tenant)
  const list =
    switchable.length > 0
      ? switchable
      : (["tenant"] as AppRole[]);

  const show = list.length >= 2;
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!show) return null;

  const activeRole =
    (list.includes(activePortal as AppRole) ? (activePortal as AppRole) : list[0]) ?? "tenant";
  const triggerLabel = ROLE_LABELS[activeRole] ?? "Portal";

  const hero = variant === "hero";
  const triggerClass = hero
    ? "border-white/30 bg-white/10 text-white hover:bg-white/15"
    : "border-border bg-card text-foreground hover:bg-accent";

  async function switchTo(role: AppRole) {
    setOpen(false);
    const portal = portalForSwitchRole(role);
    if (!portal) return;
    try {
      if (portal === "caretaker") {
        navigate({ to: "/caretaker" });
        return;
      }
      if (portal === "admin") {
        navigate({ to: "/admin", search: { tab: undefined } });
        return;
      }
      await setActivePortalChoice(portal);
      navigate({ to: PORTAL_HOME[portal] as "/tenant" });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${triggerClass}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {triggerLabel}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-44 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg">
          {list.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => void switchTo(role)}
              className={`flex w-full px-3 py-2 text-left text-sm transition hover:bg-accent ${
                role === activeRole ? "font-semibold text-primary" : "text-foreground"
              }`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void navigate({
                to: "/settings",
                search: { tab: "portals" } as never,
              });
            }}
            className="flex w-full px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            + Add another role
          </button>
        </div>
      )}
    </div>
  );
}
