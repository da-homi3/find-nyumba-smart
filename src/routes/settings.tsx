import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useId, type SubmitEvent, type ReactNode } from "react";
import {
  Building2,
  Home,
  Briefcase,
  Users,
  KeyRound,
  LogOut,
  Shield,
  Clock,
  User,
  Bell,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PORTAL_HOME, type PortalId } from "@/lib/portal-guard";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/utils";
import { isKenyanPhone } from "@/lib/phone";
import {
  readNotificationPrefs,
  writeNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notification-prefs";
import { scorePassword } from "@/lib/password-strength";
import { validatePasswordPair } from "@/lib/validate-password";
import { setSavedSearchAlertsEnabled } from "@/lib/api/search.functions";
import { useTheme, type ThemeMode } from "@/hooks/use-theme";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — NyumbaSearch" }] }),
  component: SettingsPage,
});

type Tab = "profile" | "notifications" | "security" | "portals";

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

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Lock },
  { id: "portals", label: "Portals", icon: Building2 },
];

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const {
    user,
    pendingApplications,
    activePortal,
    hasApprovedRole,
    setActivePortalChoice,
    signOut,
  } = useAuth();
  const { isPlus, entitlements } = useEntitlements();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  const [tab, setTab] = useState<Tab>("profile");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => readNotificationPrefs(user?.id));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const strength = useMemo(() => scorePassword(newPassword), [newPassword]);

  const { data: profile } = useQuery({
    queryKey: ["settings-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setFullName(profile?.full_name ?? user?.user_metadata?.full_name ?? "");
    setPhone(profile?.phone ?? user?.user_metadata?.phone ?? "");
  }, [profile, user?.user_metadata?.full_name, user?.user_metadata?.phone]);

  useEffect(() => {
    if (user?.id) setPrefs(readNotificationPrefs(user.id));
  }, [user?.id]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <p className="text-sm text-muted-foreground">Sign in to manage your account and portals.</p>
        <Link
          to="/auth"
          search={{ redirect: "/settings" }}
          className="mt-4 inline-block font-semibold text-primary"
        >
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
    if (portal === "admin") {
      navigate({ to: "/admin" });
      return;
    }
    const def = PORTALS.find((p) => p.id === portal);
    if (def?.role && !hasApprovedRole(def.role)) {
      const applyRoutes: Partial<Record<PortalId, "/landlord" | "/manager" | "/agency">> = {
        landlord: "/landlord",
        manager: "/manager",
        agency: "/agency",
      };
      const applyRoute = applyRoutes[portal];
      if (applyRoute) navigate({ to: applyRoute });
      return;
    }
    try {
      await setActivePortalChoice(portal);
      navigate({ to: PORTAL_HOME[portal] as "/tenant" });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function saveProfile(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    if (phone.trim() && !isKenyanPhone(phone)) {
      toast.error("Enter a valid Kenyan mobile number");
      return;
    }
    setSavingProfile(true);
    try {
      const nextProfile = {
        id: user.id,
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
      };
      const { error } = await supabase.from("profiles").upsert(nextProfile, { onConflict: "id" });
      if (error) throw error;
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { full_name: nextProfile.full_name, phone: nextProfile.phone },
      });
      if (metadataError) throw metadataError;
      qc.invalidateQueries({ queryKey: ["settings-profile", user.id] });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  function updatePref<K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) {
    if (!user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    writeNotificationPrefs(user.id, next);
    toast.success("Notification preference saved");
  }

  async function toggleSavedAlerts(enabled: boolean) {
    updatePref("savedAlerts", enabled);
    try {
      await setSavedSearchAlertsEnabled({ data: { enabled } });
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function changePassword(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const passwordError = validatePasswordPair(newPassword, confirmPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-5 pb-24 pt-10">
      <Link to="/tenant" className="text-sm text-muted-foreground">
        ← Back
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-muted-foreground">{user.email}</p>

      <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl border bg-secondary p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
              tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <section className="mt-6 space-y-6">
          <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border bg-card p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Profile
            </h2>
            <Field label="Full name">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="Phone (M-Pesa)">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </Field>
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </form>

          <section className="rounded-2xl border bg-card p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              NyumbaSearch Plus
            </h2>
            <p className="mt-2 text-sm">
              {isPlus ? (
                <>
                  Active until{" "}
                  {entitlements.plusExpiresAt
                    ? new Date(entitlements.plusExpiresAt).toLocaleDateString()
                    : "renewal"}
                </>
              ) : (
                "Free plan — upgrade for early listing access and scam scores."
              )}
            </p>
            <Link
              to={isPlus ? "/tenant/profile" : "/tenant/checkout"}
              search={isPlus ? undefined : { plan: "plus" }}
              className="mt-3 inline-block text-sm font-semibold text-primary"
            >
              {isPlus ? "Manage membership →" : "Upgrade to Plus →"}
            </Link>
          </section>
        </section>
      )}

      {tab === "notifications" && (
        <section className="mt-6 space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Notifications
          </h2>
          <ToggleRow
            label="Saved search alerts"
            description="Email when new listings match your saved searches"
            checked={prefs.savedAlerts}
            onChange={(v) => void toggleSavedAlerts(v)}
          />
          <ToggleRow
            label="Message updates"
            description="When landlords reply to your inquiries"
            checked={prefs.messageUpdates}
            onChange={(v) => updatePref("messageUpdates", v)}
          />
          <ToggleRow
            label="Viewing reminders"
            description="Reminders before scheduled property viewings"
            checked={prefs.viewingReminders}
            onChange={(v) => updatePref("viewingReminders", v)}
          />
          <div className="border-t pt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Appearance
            </p>
            <label className="mt-2 block text-sm font-medium" htmlFor="theme-mode">
              Theme
            </label>
            <select
              id="theme-mode"
              value={themeMode}
              onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </section>
      )}

      {tab === "security" && (
        <section className="mt-6">
          <form onSubmit={changePassword} className="space-y-4 rounded-2xl border bg-card p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Change password
            </h2>
            <Field label="New password">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </Field>
            <div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${strength.barClass}`}
                  style={{ width: `${Math.min(100, (strength.score / 5) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{strength.label}</p>
            </div>
            <Field label="Confirm new password">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </Field>
            <button
              type="submit"
              disabled={savingPassword}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {savingPassword ? "Updating…" : "Update password"}
            </button>
            <Link
              to="/auth/reset"
              search={{ email: user.email }}
              className="block text-center text-xs font-semibold text-primary"
            >
              Forgot password? Reset via email
            </Link>
          </form>
        </section>
      )}

      {tab === "portals" && (
        <>
          <section className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Your portals
            </h2>
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
                    {locked && (
                      <span className="text-[10px] font-bold text-amber-600">
                        APPROVAL REQUIRED
                      </span>
                    )}
                    {isActive && !locked && (
                      <span className="text-[10px] font-bold text-primary">ACTIVE</span>
                    )}
                  </button>
                );
              })}
              {hasApprovedRole("admin") && (
                <Link
                  to="/admin"
                  search={{ tab: "applications" }}
                  className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left hover:border-primary/40"
                >
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">Admin</p>
                    <p className="text-xs text-muted-foreground">Verifications and applications</p>
                  </div>
                </Link>
              )}
            </div>
          </section>

          {(pending.length > 0 || rejected.length > 0) && (
            <section className="mt-8">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Applications
              </h2>
              <div className="mt-3 space-y-2">
                {pending.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center gap-2 rounded-xl border bg-amber-500/10 px-4 py-3 text-sm"
                  >
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="capitalize">{app.requested_role}</span> — pending ops review
                  </div>
                ))}
                {rejected.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-xl border px-4 py-3 text-sm text-muted-foreground"
                  >
                    <span className="capitalize font-medium text-foreground">
                      {app.requested_role}
                    </span>{" "}
                    — not approved
                    {app.rejection_reason && <p className="mt-1 text-xs">{app.rejection_reason}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
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

function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="block text-sm font-medium">
      <span className="mb-1.5 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: Readonly<{
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}>) {
  const inputId = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3">
      <label htmlFor={inputId} className="flex-1 cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </label>
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 rounded border-primary accent-primary"
        aria-label={label}
      />
    </div>
  );
}
