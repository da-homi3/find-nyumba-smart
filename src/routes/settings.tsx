import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Home,
  Briefcase,
  Users,
  KeyRound,
  LogOut,
  Shield,
  Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PORTAL_HOME, type PortalId } from "@/lib/portal-guard";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const PORTALS: {
  id: PortalId;
  label: string;
  description: string;
  icon: typeof Home;
  role?: "landlord" | "manager" | "agency" | "admin";
}[] = [
  { id: "tenant", label: "Tenant", description: "Browse and save homes", icon: Home },
  {
    id: "landlord",
    label: "Landlord",
    description: "Manage your listings",
    icon: Building2,
    role: "landlord",
  },
  {
    id: "manager",
    label: "Property manager",
    description: "Portfolio and leads",
    icon: Briefcase,
    role: "manager",
  },
  {
    id: "agency",
    label: "Real estate agency",
    description: "Bulk listings and team",
    icon: Users,
    role: "agency",
  },
  { id: "caretaker", label: "Caretaker", description: "PIN sign-in from landlord", icon: KeyRound },
];

function SettingsPage() {
  const navigate = useNavigate();
  const {
    user,
    roles,
    pendingApplications,
    activePortal,
    hasApprovedRole,
    setActivePortalChoice,
    signOut,
  } = useAuth();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <p className="text-sm text-muted-foreground">Sign in to manage your account and portals.</p>
        <Link to="/auth" search={{ redirect: "/settings" }} className="mt-4 inline-block font-semibold text-primary">
          Sign in
        </Link>
      </div>
    );
  }

  const pending = pendingApplications.filter((a) => a.status === "pending");
  const rejected = pendingApplications.filter((a) => a.status === "rejected");

  async function enterPortal(portal: PortalId) {
    if (portal === "caretaker") {
      navigate({ to: "/caretaker" });
      return;
    }
    const def = PORTALS.find((p) => p.id === portal);
    if (def?.role && !hasApprovedRole(def.role)) return;
    await setActivePortalChoice(portal);
    navigate({ to: PORTAL_HOME[portal] as "/tenant" });
  }

  return (
    <div className="mx-auto max-w-lg px-5 pb-24 pt-10">
      <Link to="/tenant" className="text-sm text-muted-foreground">
        ← Back
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-muted-foreground">{user.email}</p>

      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your portals</h2>
        <div className="mt-3 space-y-2">
          {PORTALS.map((p) => {
            const locked = p.role ? !hasApprovedRole(p.role) : false;
            const isActive = activePortal === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={locked}
                onClick={() => enterPortal(p.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${
                  isActive ? "border-primary bg-primary/5" : "bg-card"
                } ${locked ? "opacity-50" : "hover:border-primary/40"}`}
              >
                <p.icon className="h-5 w-5 shrink-0 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
                {locked && <span className="text-[10px] font-bold text-amber-600">APPROVAL REQUIRED</span>}
                {isActive && !locked && (
                  <span className="text-[10px] font-bold text-primary">ACTIVE</span>
                )}
              </button>
            );
          })}
          {hasApprovedRole("admin") && (
            <button
              type="button"
              onClick={() => enterPortal("admin")}
              className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left hover:border-primary/40"
            >
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Admin</p>
                <p className="text-xs text-muted-foreground">Verifications and applications</p>
              </div>
            </button>
          )}
        </div>
      </section>

      {(pending.length > 0 || rejected.length > 0) && (
        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Applications</h2>
          <div className="mt-3 space-y-2">
            {pending.map((app) => (
              <div key={app.id} className="flex items-center gap-2 rounded-xl border bg-amber-500/10 px-4 py-3 text-sm">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="capitalize">{app.requested_role}</span> — pending ops review
              </div>
            ))}
            {rejected.map((app) => (
              <div key={app.id} className="rounded-xl border px-4 py-3 text-sm text-muted-foreground">
                <span className="capitalize font-medium text-foreground">{app.requested_role}</span> — not approved
                {app.rejection_reason && <p className="mt-1 text-xs">{app.rejection_reason}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => signOut()}
        className="mt-10 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold text-destructive"
      >
        <LogOut className="h-4 w-4" /> Sign out everywhere
      </button>
    </div>
  );
}
