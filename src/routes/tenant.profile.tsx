import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { User, LogOut, Building2, ShieldCheck, Bell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tenant/profile")({
  component: Profile,
});

function Profile() {
  const { user, signOut } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-5 pt-10">
      <header className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-emerald text-2xl font-semibold text-primary-foreground">
          {user?.email?.[0]?.toUpperCase() ?? <User className="h-7 w-7" />}
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold">{user?.email ?? "Guest"}</h1>
          <p className="text-xs text-muted-foreground">
            {user ? "Tenant account" : "Not signed in"}
          </p>
        </div>
      </header>

      {!user ? (
        <Link
          to="/auth"
          className="mt-6 block rounded-2xl bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground"
        >
          Sign in or create an account
        </Link>
      ) : null}

      <ul className="mt-8 divide-y rounded-2xl border bg-card">
        {[
          { icon: ShieldCheck, label: "Verification", hint: "Verify your phone & ID" },
          { icon: Bell, label: "Notifications", hint: "Manage alerts" },
          {
            icon: Building2,
            label: "Become a landlord",
            hint: "List your property",
            to: "/landlord",
          },
        ].map((i) => {
          const Inner = (
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary">
                <i.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{i.label}</div>
                <div className="text-xs text-muted-foreground">{i.hint}</div>
              </div>
              <span className="text-muted-foreground">›</span>
            </div>
          );
          return (
            <li key={i.label}>
              {i.to ? (
                <Link to={i.to}>{Inner}</Link>
              ) : (
                <button
                  type="button"
                  onClick={() => toast.info(`${i.label} settings will be available soon.`)}
                  className="w-full text-left"
                >
                  {Inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {user && (
        <button
          onClick={signOut}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 px-6 py-3 text-sm font-semibold text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      )}
    </div>
  );
}
