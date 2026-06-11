import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PlanCards } from "@/components/PlanCards";
import { useState } from "react";
import { initiateMpesaPayment } from "@/lib/api/payment.functions";
import { toast } from "sonner";
import { X } from "lucide-react";

export const Route = createFileRoute("/landlord/dashboard/plan")({
  component: () => (
    <LandlordShell>
      <PlanPage />
    </LandlordShell>
  ),
});

function PlanPage() {
  const [showPay, setShowPay] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await initiateMpesaPayment({
        data: {
          amountKes: 999,
          paymentType: "premium_subscription",
          phoneNumber: phone.trim(),
        },
      });
      toast.success(res.message);
      setShowPay(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-semibold">Your plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You're on Free. Upgrade for more listings and analytics.
      </p>
      <div className="mt-8">
        <PlanCards showCta={false} />
      </div>
      <button
        type="button"
        onClick={() => setShowPay(true)}
        className="mt-8 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
      >
        Upgrade to Pro — M-Pesa
      </button>

      {showPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur">
          <form onSubmit={handleUpgrade} className="relative w-full max-w-sm rounded-2xl border bg-card p-6">
            <button type="button" onClick={() => setShowPay(false)} className="absolute right-4 top-4" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-semibold">M-Pesa payment</h3>
            <p className="mt-1 text-xs text-muted-foreground">Landlord Pro — KES 999/mo</p>
            <input
              type="tel"
              required
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-4 w-full rounded-xl border px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Sending STK push…" : "Confirm payment"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
