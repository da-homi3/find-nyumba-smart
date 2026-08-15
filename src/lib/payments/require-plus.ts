import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getTenantPlusStatus } from "@/lib/revenue/subscription-store";
import { PLUS_PLAN } from "@/lib/revenue/plans";

type Db = SupabaseClient<Database>;

export class PlusRequiredError extends Error {
  readonly code = "plus_required" as const;
  readonly checkoutUrl = "/tenant/checkout?plan=plus";

  constructor(message = "This is a NyumbaSearch Plus feature.") {
    super(message);
    this.name = "PlusRequiredError";
  }
}

export async function requirePlus(db: Db, userId: string): Promise<void> {
  const { data: adminRole } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (adminRole) return;

  const plus = await getTenantPlusStatus(db, userId);
  if (plus.tenantPlan !== "plus") {
    throw new PlusRequiredError();
  }
}

export function plusRequiredPayload(message = "This is a NyumbaSearch Plus feature.") {
  return {
    error: "plus_required" as const,
    message,
    upsell: {
      plan: "plus" as const,
      priceMonthly: PLUS_PLAN.monthlyKes,
      checkoutUrl: "/tenant/checkout?plan=plus",
    },
  };
}
