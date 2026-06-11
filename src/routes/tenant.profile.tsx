import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Bell,
  Building2,
  CheckCircle2,
  Loader2,
  LogOut,
  ShieldCheck,
  User,
  Calendar,
  X,
  Upload,
  CreditCard,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { submitVerification } from "@/lib/api/trust.functions";
import { listMyViewings, updateViewingStatus } from "@/lib/api/booking.functions";
import { listTransactions } from "@/lib/api/payment.functions";

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
  const { user, signOut, roles } = useAuth();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<TenantNotificationPrefs>(() => readPrefs(user?.id));

  // Verification uploads state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verType, setVerType] = useState<"phone" | "identity" | "business" | "ownership">(
    "identity",
  );
  const [docUrl, setDocUrl] = useState("");
  const [verLoading, setVerLoading] = useState(false);

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
        .select(
          "full_name, phone, is_phone_verified, is_id_verified, is_business_verified, is_ownership_verified",
        )
        .eq("id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch tenant viewings
  const { data: viewings = [] } = useQuery({
    queryKey: ["my-viewings"],
    enabled: !!user,
    queryFn: () => listMyViewings(),
  });

  // Fetch transactions list
  const { data: transactions = [] } = useQuery({
    queryKey: ["my-transactions"],
    enabled: !!user,
    queryFn: () => listTransactions(),
  });

  useEffect(() => {
    setFullName(profile?.full_name ?? user?.user_metadata?.full_name ?? "");
    setPhone(profile?.phone ?? user?.user_metadata?.phone ?? "");
  }, [profile, user?.user_metadata?.full_name, user?.user_metadata?.phone]);

  useEffect(() => {
    setPrefs(readPrefs(user?.id));
  }, [user?.id]);

  const handleCancelViewing = useMutation({
    mutationFn: async (viewingId: string) => {
      await updateViewingStatus({ data: { viewingId, status: "cancelled" } });
    },
    onSuccess: () => {
      toast.success("Viewing cancelled successfully");
      qc.invalidateQueries({ queryKey: ["my-viewings"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

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

  async function handleUploadVerification(e: FormEvent) {
    e.preventDefault();
    if (!docUrl.trim()) {
      toast.error("Please enter a document URL link");
      return;
    }
    setVerLoading(true);
    try {
      await submitVerification({
        data: {
          verificationType: verType,
          documents: [docUrl.trim()],
          notes: `Requested ${verType} verification.`,
        },
      });
      toast.success("Verification request submitted successfully for approval!");
      setIsVerifying(false);
      setDocUrl("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setVerLoading(false);
    }
  }

  function updatePrefs(next: TenantNotificationPrefs) {
    setPrefs(next);
    if (user && typeof window !== "undefined") {
      window.localStorage.setItem(getPrefsKey(user.id), JSON.stringify(next));
      toast.success("Notification preferences saved");
    }
  }

  const isAdmin = roles?.includes("admin");

  return (
    <div className="mx-auto max-w-2xl px-5 pt-10 pb-20">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-emerald text-2xl font-semibold text-primary-foreground">
            {initials || <User className="h-7 w-7" />}
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">
              {fullName || user?.email || "Guest"}
            </h1>
            <p className="text-xs text-muted-foreground">{user ? user.email : "Not signed in"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to="/settings"
            className="rounded-xl border bg-card px-3.5 py-1.5 text-xs font-semibold text-primary"
          >
            Settings
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="rounded-xl border bg-card px-3.5 py-1.5 text-xs font-semibold text-primary"
            >
              Admin
            </Link>
          )}
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

          {/* Verification section */}
          <section className="mt-6 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-display text-sm font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4.5 w-4.5 text-primary" /> Verification Levels
              </h2>
              {!isVerifying && (
                <button
                  onClick={() => setIsVerifying(true)}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  Verify Now
                </button>
              )}
            </div>

            {isVerifying ? (
              <form onSubmit={handleUploadVerification} className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Verify Identity / Business</span>
                  <button type="button" onClick={() => setIsVerifying(false)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <label className="block">
                  <span className="text-[10px] text-muted-foreground block mb-1">Select Level</span>
                  <select
                    value={verType}
                    onChange={(e) => setVerType(e.target.value as any)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none"
                  >
                    <option value="phone">Level 1: Phone Verification</option>
                    <option value="identity">Level 2: National ID Verification</option>
                    <option value="business">Level 3: Business/Agency Verification</option>
                    <option value="ownership">Level 4: Land Ownership Verification</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] text-muted-foreground block mb-1">
                    Document Link / URL
                  </span>
                  <input
                    type="url"
                    placeholder="https://example.com/id-image.jpg"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={verLoading}
                  className="w-full rounded-xl bg-gradient-emerald text-primary-foreground text-xs font-semibold py-2.5 shadow-soft"
                >
                  {verLoading ? "Submitting..." : "Submit for Approval"}
                </button>
              </form>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "Phone", status: profile?.is_phone_verified },
                  { label: "Identity", status: profile?.is_id_verified },
                  { label: "Business", status: profile?.is_business_verified },
                  { label: "Ownership", status: profile?.is_ownership_verified },
                ].map((l) => (
                  <div
                    key={l.label}
                    className="rounded-xl border bg-background p-2.5 flex items-center justify-between"
                  >
                    <span>{l.label}</span>
                    <span
                      className={`font-bold ${l.status ? "text-emerald-500" : "text-muted-foreground/60"}`}
                    >
                      {l.status ? "Verified" : "Pending/None"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Viewing Schedule list */}
          <section className="mt-6 rounded-2xl border bg-card p-4">
            <h2 className="font-display text-sm font-semibold flex items-center gap-1.5 border-b pb-3">
              <Calendar className="h-4.5 w-4.5 text-primary" /> Scheduled Viewings
            </h2>
            {viewings.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground text-center py-4">
                No scheduled viewings yet.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {viewings.map((v: any) => (
                  <div
                    key={v.id}
                    className="rounded-xl border bg-background p-3 flex justify-between items-start gap-4"
                  >
                    <div>
                      <strong className="text-xs block font-semibold">{v.properties?.title}</strong>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Date: {new Date(v.scheduled_at).toLocaleString()}
                      </span>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold mt-2 ${
                          v.status === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : v.status === "cancelled"
                              ? "bg-red-500/10 text-red-600"
                              : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {v.status.toUpperCase()}
                      </span>
                    </div>
                    {v.status === "pending" && (
                      <button
                        onClick={() => handleCancelViewing.mutate(v.id)}
                        className="rounded-lg border border-red-500/20 text-red-500 px-2 py-1 text-[10px] font-semibold hover:bg-red-500/15"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Payment Transactions list */}
          <section className="mt-6 rounded-2xl border bg-card p-4">
            <h2 className="font-display text-sm font-semibold flex items-center gap-1.5 border-b pb-3">
              <CreditCard className="h-4.5 w-4.5 text-primary" /> M-Pesa Transactions
            </h2>
            {transactions.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground text-center py-4">
                No transactions found.
              </p>
            ) : (
              <div className="mt-3 divide-y text-xs">
                {transactions.map((t: any) => (
                  <div key={t.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <strong className="font-semibold block capitalize">
                        {t.payment_type.replace("_", " ")}
                      </strong>
                      <span className="text-[10px] text-muted-foreground">
                        Receipt: {t.mpesa_receipt} · {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">
                        KES {t.amount_kes.toLocaleString()}
                      </div>
                      <span className="text-[9px] uppercase font-bold text-emerald-600">
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

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
