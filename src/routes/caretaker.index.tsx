import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { verifyCaretakerLogin, validateCaretakerSession } from "@/lib/api/caretaker.functions";
import { setCaretakerToken, clearCaretakerToken, getCaretakerToken } from "@/lib/caretaker-session";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/caretaker/")({
  head: () => ({ meta: [{ title: "Caretaker sign in — NyumbaSearch" }] }),
  component: CaretakerSignIn,
});

function CaretakerSignIn() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getCaretakerToken();
    if (!token) return;
    validateCaretakerSession({ data: { token } })
      .then(() => navigate({ to: "/caretaker/dashboard" }))
      .catch(() => clearCaretakerToken());
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-sm px-6 pt-10">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <div className="mt-8">
          <BrandLogo logoClassName="h-9" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">Caretaker sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the phone and 4-digit PIN your landlord gave you.
        </p>
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pin.length !== 4) {
              toast.error("PIN must be 4 digits");
              return;
            }
            setLoading(true);
            try {
              const res = await verifyCaretakerLogin({ data: { phone, pin } });
              setCaretakerToken(res.token);
              toast.success(`Welcome, ${res.caretakerName}`);
              navigate({ to: "/caretaker/dashboard" });
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setLoading(false);
            }
          }}
        >
          <label className="block text-sm font-medium">
            Phone (M-Pesa number)
            <input
              type="tel"
              required
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm font-medium">
            4-digit PIN
            <input
              inputMode="numeric"
              maxLength={4}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replaceAll(/\D/g, ""))}
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm tracking-[0.5em]"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
