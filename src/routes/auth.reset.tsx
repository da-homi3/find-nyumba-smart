import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth/reset")({
  head: () => ({ meta: [{ title: "Reset password — NyumbaSearch" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pt-10">
        <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <h1 className="mt-6 font-display text-3xl font-semibold">Reset password</h1>

        {step === "email" && (
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("OTP sent to your email (mock)");
              setStep("otp");
            }}
          >
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
            <button type="submit" className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
              Send OTP
            </button>
          </form>
        )}

        {step === "otp" && (
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\d{6}$/.test(otp)) {
                toast.error("Enter a 6-digit OTP");
                return;
              }
              setStep("password");
            }}
          >
            <label className="block text-sm font-medium">
              6-digit OTP
              <input
                inputMode="numeric"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm tracking-widest"
              />
            </label>
            <button type="submit" className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
              Verify OTP
            </button>
          </form>
        )}

        {step === "password" && (
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Password updated — sign in with your new password");
              navigate({ to: "/auth" });
            }}
          >
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
            <button type="submit" className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
              Set new password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
