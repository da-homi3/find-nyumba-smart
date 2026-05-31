import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: TenantAuth,
});

function TenantAuth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/tenant`,
            data: { full_name: fullName, role: "tenant" },
          },
        });
        if (error) throw error;
        toast.success("Welcome to NyumbaSearch!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/tenant" });
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
            ? "Sign in to save homes and contact landlords."
            : "Join thousands finding verified homes."}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {mode === "signup" && (
            <Field label="Full name">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={inputCls}
              />
            </Field>
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
            className="w-full rounded-xl bg-gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New to NyumbaSearch?" : "Already have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-semibold text-primary"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Are you a landlord?{" "}
          <Link to="/landlord" className="font-semibold text-foreground">
            Landlord access →
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
