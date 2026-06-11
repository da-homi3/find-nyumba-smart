import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, ArrowLeft } from "lucide-react";

const CARETAKER_KEY = "nyumba_caretaker_session";

export function isCaretakerSignedIn() {
  return typeof window !== "undefined" && !!localStorage.getItem(CARETAKER_KEY);
}

export function caretakerSignIn(phone: string) {
  localStorage.setItem(CARETAKER_KEY, JSON.stringify({ phone, at: Date.now() }));
}

export const Route = createFileRoute("/caretaker/")({
  head: () => ({ meta: [{ title: "Caretaker sign in — NyumbaSearch" }] }),
  component: CaretakerSignIn,
});

function CaretakerSignIn() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-sm px-6 pt-10">
        <Link to="/landlord" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Landlord portal
        </Link>
        <div className="mt-8 grid h-12 w-12 place-items-center rounded-xl bg-primary/10">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">Caretaker sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the phone and PIN your landlord assigned you.
        </p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.length !== 4) {
              toast.error("PIN must be 4 digits");
              return;
            }
            caretakerSignIn(phone);
            toast.success("Welcome back");
            navigate({ to: "/caretaker/dashboard" });
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
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm tracking-[0.5em]"
            />
          </label>
          <button type="submit" className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
