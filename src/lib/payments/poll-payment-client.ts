import { verifyPaymentStatus } from "@/lib/api/payment.functions";

export type PollPaymentCallbacks = {
  onPhase?: (phase: "awaiting_pin" | "confirming") => void;
  onMessage?: (message: string) => void;
};

/** Poll until M-Pesa/card payment completes or fails (shared by checkout + contact unlock). */
export async function pollPaymentUntilComplete(
  paymentId: string,
  callbacks: PollPaymentCallbacks = {},
): Promise<{ receipt?: string }> {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    let delay = 2500;
    if (i === 0) delay = 1500;
    else if (i < 3) delay = 2000;
    else if (i > 15) delay = 3500;
    await new Promise((r) => setTimeout(r, delay));

    callbacks.onPhase?.(i < 3 ? "awaiting_pin" : "confirming");
    const status = await verifyPaymentStatus({ data: { paymentId } });
    callbacks.onMessage?.(status.message ?? "Confirming payment…");

    if (status.status === "completed") {
      return { receipt: status.receipt };
    }
    if (status.status === "failed") {
      throw new Error(status.message ?? "Payment failed or was cancelled");
    }
  }
  throw new Error("Payment timed out. If you entered your PIN, wait a moment and refresh.");
}
