import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/auth/reset")({
  head: () => ({ meta: [{ title: "Reset password — NyumbaSearch" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = globalThis.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token=")) {
      setMode("update");
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const redirectTo = `${globalThis.location.origin}/auth/reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      toast.success("Check your email for the password reset link.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — sign in with your new password");
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pt-10">
        <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <h1 className="mt-6 font-display text-3xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "request"
            ? "We'll email you a secure link to choose a new password."
            : "Choose a new password for your account."}
        </p>

        {mode === "request" ? (
          <form className="mt-8 space-y-4" onSubmit={requestReset}>
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={updatePassword}>
            <label className="block text-sm font-medium">
              New password
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-medium">
              Confirm password
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {loading ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
