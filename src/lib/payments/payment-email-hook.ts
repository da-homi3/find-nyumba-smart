import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendPaymentLifecycleEmails } from "@/lib/email/payment-notifications";

type Admin = SupabaseClient<Database>;
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

/** Non-blocking payment emails after successful fulfillment. */
export function queuePaymentEmails(admin: Admin, payment: PaymentRow | null | undefined): void {
  if (!payment || payment.status !== "completed") return;
  void sendPaymentLifecycleEmails(admin, payment).catch((err) => {
    console.error("[email] Payment lifecycle emails failed:", err);
  });
}
