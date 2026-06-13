import { useEffect } from "react";
import { toast } from "sonner";
import { verifyStripeCheckoutSession } from "@/lib/api/payment.functions";
import { errorMessage } from "@/lib/utils";

/** Completes checkout when returning from Stripe with ?stripe=success&session_id=… */
export function useStripeCheckoutReturn(onSuccess: () => void) {
  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    if (params.get("stripe") !== "success") return;

    const sessionId = params.get("session_id");
    if (!sessionId) return;

    let active = true;
    verifyStripeCheckoutSession({ data: { sessionId } })
      .then((res) => {
        if (!active) return;
        if (res.status === "completed") {
          onSuccess();
          globalThis.history.replaceState({}, "", globalThis.location.pathname);
          return;
        }
        toast.error("Payment is still processing. Refresh in a moment.");
      })
      .catch((err) => {
        if (active) toast.error(errorMessage(err));
      });

    return () => {
      active = false;
    };
  }, [onSuccess]);
}
