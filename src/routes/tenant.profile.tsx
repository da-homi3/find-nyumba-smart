import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Bell, Building2, CheckCircle2, Loader2, LogOut, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/tenant/profile")({
  component: Profile,
});

type TenantNotificationPrefs = {
  savedAlerts: boolean;
  messageUpdates: boolean;
  viewingReminders: boolean;
};

const DEFAULT_PREFS: TenantNotificationPrefs = {
  savedAlerts: true,
  messageUpdates: true,
  viewingReminders: false,
};

function getPrefsKey(userId: string) {
  return `nyumba_tenant_notification_prefs:${userId}`;
}

function readPrefs(userId?: string): TenantNotificationPrefs {
  if (!userId || typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(getPrefsKey(userId));
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function Profile() {
  const { user, signOut } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<TenantNotificationPrefs>(() => readPrefs(user?.id));

  const initials = useMemo(() => {
    const source = fullName.trim() || user?.email || "";
    return source
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [fullName, user?.email]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["tenant-profile", user?.id],
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
    setPrefs(readPrefs(user?.id));
  }, [user?.id]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const nextProfile = {
        id: user.id,
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
      };

      const { error } = await supabase.from("profiles").upsert(nextProfile, { onConflict: "id" });
      if (error) throw error;

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          full_name: nextProfile.full_name,
          phone: nextProfile.phone,
        },
      });
      if (metadataError) throw metadataError;

      toast.success("Profile updated");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function updatePrefs(next: TenantNotificationPrefs) {
    setPrefs(next);
    if (user && typeof window !== "undefined") {
      window.localStorage.setItem(getPrefsKey(user.id), JSON.stringify(next));
      toast.success("Notification preferences saved");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pt-10">
      <header className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-emerald text-2xl font-semibold text-primary-foreground">
          {initials || <User className="h-7 w-7" />}
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold">
            {fullName || user?.email || "Guest"}
          </h1>
          <p className="text-xs text-muted-foreground">{user ? user.email : "Not signed in"}</p>
        </div>
      </header>

      {!user ? (
        <Link
          to="/auth"
          className="mt-6 block rounded-2xl bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground"
        >
          Sign in or create an account
        </Link>
      ) : (
        <>
          <form onSubmit={saveProfile} className="mt-8 rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Account details</h2>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading || saving}
                  className={inputCls}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isLoading || saving}
                  className={inputCls}
                  placeholder="+254 7..."
                />
              </Field>
            </div>
            <button
              type="submit"
              disabled={isLoading || saving}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60 sm:w-auto"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Save profile
            </button>
          </form>

          <section className="mt-6 rounded-2xl border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-4">
              <Bell className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Notifications</h2>
            </div>
            <ToggleRow
              label="Saved-search alerts"
              hint="Notify me when matching listings appear."
              checked={prefs.savedAlerts}
              onChange={(checked) => updatePrefs({ ...prefs, savedAlerts: checked })}
            />
            <ToggleRow
              label="Message updates"
              hint="Notify me when landlords respond."
              checked={prefs.messageUpdates}
              onChange={(checked) => updatePrefs({ ...prefs, messageUpdates: checked })}
            />
            <ToggleRow
              label="Viewing reminders"
              hint="Remind me before scheduled viewings."
              checked={prefs.viewingReminders}
              onChange={(checked) => updatePrefs({ ...prefs, viewingReminders: checked })}
            />
          </section>

          <ul className="mt-6 divide-y rounded-2xl border bg-card">
            <li>
              <button
                type="button"
                onClick={() =>
                  toast.success(
                    phone
                      ? "Phone number saved for verification"
                      : "Add a phone number to start verification",
                  )
                }
                className="w-full text-left"
              >
                <SettingsRow
                  icon={ShieldCheck}
                  label="Verification"
                  hint={phone ? "Phone ready for verification" : "Add your phone number first"}
                />
              </button>
            </li>
            <li>
              <Link to="/landlord">
                <SettingsRow icon={Building2} label="Become a landlord" hint="List your property" />
              </Link>
            </li>
          </ul>

          <button
            type="button"
            onClick={signOut}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 px-6 py-3 text-sm font-semibold text-destructive"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-4 px-4 py-4">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-primary"
      />
    </label>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  hint,
}: {
  icon: typeof ShieldCheck;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-4">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <span className="text-muted-foreground">&gt;</span>
    </div>
  );
}
