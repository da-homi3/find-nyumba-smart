import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  getMyProfilePortal,
  listMyPortalApplications,
  registerPortalApplicationAfterSignup,
  submitPortalApplication,
} from "@/lib/api/portal.functions";
import { resolvePostLoginPath, type AppRole, type PortalId } from "@/lib/portal-guard";
import type { User } from "@supabase/supabase-js";
import { Building2, BarChart3, Users, Sparkles, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/landlord/")({
  head: () => ({ meta: [{ title: "Landlord Portal — NyumbaSearch" }] }),
  component: LandlordEntry,
});

function LandlordEntry() {
  const { user, isLandlord, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && isLandlord) navigate({ to: "/landlord/dashboard" });
  }, [user, isLandlord, loading, navigate]);

  return (
    <div className="min-h-screen bg-foreground text-background">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-12 px-6 py-10 lg:grid-cols-2 lg:py-16">
        {/* Pitch */}
        <div className="flex flex-col">
          <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm text-background/70">
            <ArrowLeft className="h-4 w-4" /> Back to tenants
          </Link>

          <div className="mt-10 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-background/20 bg-background/10 px-3 py-1 text-xs font-medium">
              <Building2 className="h-3 w-3 text-gold" /> Landlord Portal
            </div>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight sm:text-5xl">
              Reach verified tenants <span className="text-gold">directly</span>.
            </h1>
            <p className="mt-5 max-w-md text-background/75">
              List, track, and rent your properties from one premium dashboard. No middlemen, no
              agent fees, no friction.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: BarChart3,
                  t: "Live analytics",
                  d: "Views, saves, lead conversion per unit.",
                },
                { icon: Users, t: "Direct leads", d: "Verified tenant inquiries in real time." },
                {
                  icon: Sparkles,
                  t: "AI optimization",
                  d: "Pricing & listing quality suggestions.",
                },
                { icon: Building2, t: "Multi-property", d: "Manage one building or twenty." },
              ].map((f) => (
                <div
                  key={f.t}
                  className="rounded-2xl border border-background/15 bg-background/5 p-4"
                >
                  <f.icon className="h-5 w-5 text-gold" />
                  <h3 className="mt-3 font-display font-semibold">{f.t}</h3>
                  <p className="mt-1 text-xs text-background/65">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Auth panel */}
        <div className="flex items-center">
          <LandlordAuthPanel />
        </div>
      </div>
    </div>
  );
}

function LandlordAuthPanel() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function resolveRoles(user: User): Promise<string[]> {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    return (data ?? []).map((r) => r.role as string);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/pending`,
            data: { full_name: fullName, phone, role: "landlord" },
          },
        });
        if (error) throw error;
        const reviewUrl = `${window.location.origin}/admin?tab=applications`;
        if (signUpData.session) {
          await submitPortalApplication({
            data: { requestedRole: "landlord", phone: phone.trim() || undefined },
          });
        } else if (signUpData.user?.id) {
          await registerPortalApplicationAfterSignup({
            data: {
              userId: signUpData.user.id,
              applicantName: fullName || email,
              applicantEmail: email,
              requestedRole: "landlord",
              phone: phone.trim() || undefined,
              reviewUrl,
            },
          });
        }
        toast.success("Application submitted — we'll email you when approved.");
        navigate({ to: "/auth/pending" });
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Sign in failed");

      const roles = await resolveRoles(data.user);
      const apps = await listMyPortalApplications();
      const hasPendingOnly =
        apps.some((a) => a.status === "pending") &&
        !roles.some((r) => ["landlord", "manager", "agency", "admin"].includes(r));

      if (hasPendingOnly) {
        navigate({ to: "/auth/pending" });
        return;
      }

      let activePortal: PortalId = "landlord";
      try {
        const profile = await getMyProfilePortal();
        activePortal = (profile?.active_portal as PortalId) ?? "landlord";
      } catch {
        /* profile may not be ready */
      }

      window.location.href = resolvePostLoginPath(
        roles as AppRole[],
        activePortal,
        "/landlord/dashboard",
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-3xl border border-background/15 bg-background p-8 text-foreground shadow-elegant">
      <h2 className="font-display text-2xl font-semibold">
        {mode === "signup" ? "Create landlord account" : "Welcome back"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "signup"
          ? "Get verified and list your first property today."
          : "Sign in to your landlord dashboard."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        {mode === "signup" && (
          <>
            <Field label="Full name">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={inputCls}
              />
            </Field>
            <Field label="Phone (M-Pesa)">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254 7…"
                className={inputCls}
              />
            </Field>
          </>
        )}
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className={inputCls}
          />
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background disabled:opacity-60"
        >
          {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {mode === "signup" ? "Already a landlord?" : "New here?"}{" "}
        <button
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="font-semibold text-primary"
        >
          {mode === "signup" ? "Sign in" : "Create account"}
        </button>
      </p>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Property manager?{" "}
        <Link
          to="/auth"
          search={{ redirect: "/manager/dashboard" }}
          className="font-semibold text-primary"
        >
          Sign up as manager
        </Link>
        {" · "}
        <Link to="/caretaker" className="font-semibold text-primary">
          Caretaker sign in
        </Link>
      </p>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
