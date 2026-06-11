import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

const authSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: authSearchSchema,
  component: TenantAuth,
});

type AccountRole = "tenant" | "landlord" | "manager";

function TenantAuth() {
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AccountRole>("tenant");
  const [loading, setLoading] = useState(false);

  const destination = (r: AccountRole) => {
    if (redirect) return redirect;
    if (r === "landlord") return "/landlord/dashboard";
    if (r === "manager") return "/manager/dashboard";
    return "/tenant";
  };

  async function resolveAccountRole(user: User): Promise<AccountRole> {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (data ?? []).map((r) => r.role as string);
    if (roles.includes("landlord")) return "landlord";
    if (roles.includes("manager")) return "manager";
    const meta = user.user_metadata?.role as AccountRole | undefined;
    if (meta === "landlord" || meta === "manager") return meta;
    return "tenant";
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      let nextRole: AccountRole = role;
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${destination(role)}`,
            data: { full_name: fullName, phone, role },
          },
        });
        if (error) throw error;
        toast.success("Welcome to NyumbaSearch!");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) nextRole = await resolveAccountRole(data.user);
      }
      const target = destination(nextRole);
      window.location.href = target.startsWith("/") ? target : `/${target}`;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pt-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-6 font-display text-3xl font-semibold">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to save homes and contact landlords — no agents."
            : "Join thousands finding verified homes in Nairobi."}
        </p>

        <div className="mt-6 flex rounded-xl border bg-secondary p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                mode === m ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              {m === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
              <Field label="Phone (M-Pesa number)">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="Account type">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AccountRole)}
                  className={inputCls}
                >
                  <option value="tenant">Tenant</option>
                  <option value="landlord">Landlord</option>
                  <option value="manager">Property manager</option>
                </select>
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
          {mode === "signin" && (
            <Link to="/auth/reset" className="block text-right text-xs font-semibold text-primary">
              Forgot password?
            </Link>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Are you a landlord?{" "}
          <Link to="/landlord" className="font-semibold text-foreground">
            Landlord portal →
          </Link>
          {" · "}
          <Link to="/caretaker" className="font-semibold text-foreground">
            Caretaker sign in
          </Link>
        </p>
      </div>
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
