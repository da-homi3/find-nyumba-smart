import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getTenantPlusStatus } from "@/lib/revenue/subscription-store";

type Db = SupabaseClient<Database>;

export class PlusRequiredError extends Error {
  readonly code = "plus_required" as const;
  readonly checkoutUrl = "/tenant/checkout?plan=plus";

  constructor() {
    super("In-app messaging is a NyumbaSearch Plus feature.");
    this.name = "PlusRequiredError";
  }
}

export async function requirePlus(db: Db, userId: string): Promise<void> {
  const plus = await getTenantPlusStatus(db, userId);
  if (plus.tenantPlan !== "plus") {
    throw new PlusRequiredError();
  }
}

export function plusRequiredPayload() {
  return {
    error: "plus_required" as const,
    message: "In-app messaging is a NyumbaSearch Plus feature.",
    upsell: {
      plan: "plus" as const,
      priceMonthly: 500,
      checkoutUrl: "/tenant/checkout?plan=plus",
    },
  };
}
