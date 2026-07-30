import type { PmDb } from "@/lib/pm/access";

export class PmModuleRequiredError extends Error {
  status = 402;
  code = "PM_MODULE_REQUIRED" as const;

  constructor(
    message = "Property Management is not active for this property. Subscribe to unlock rent tracking, tenants, and maintenance.",
  ) {
    super(message);
    this.name = "PmModuleRequiredError";
  }
}

export type PmSubscriptionRow = {
  id: string;
  plan: string;
  status: string;
  amount_kes: number;
  trial_end: string | null;
  next_billing_date: string;
  grace_period_end: string | null;
};

/** Active, trialing, or in-grace PM module subscription. */
export async function getActivePmSubscription(
  admin: PmDb,
  userId: string,
): Promise<PmSubscriptionRow | null> {
  const { data } = await admin
    .from("subscriptions")
    .select("id, plan, status, amount_kes, trial_end, next_billing_date, grace_period_end")
    .eq("user_id", userId)
    .eq("module", "property_management")
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const now = Date.now();
  if (data.status === "past_due") {
    if (!data.grace_period_end || new Date(data.grace_period_end).getTime() <= now) {
      return null;
    }
    return data as PmSubscriptionRow;
  }

  if (new Date(data.next_billing_date).getTime() <= now) return null;
  return data as PmSubscriptionRow;
}

export async function isFirstTimeSubscriberForModule(
  admin: PmDb,
  userId: string,
  module: "marketplace" | "property_management",
): Promise<boolean> {
  const { data } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("module", module)
    .limit(1)
    .maybeSingle();
  return !data;
}

export async function activatePmModuleForAccount(admin: PmDb, userId: string): Promise<void> {
  await admin.from("pm_properties").update({ pm_module_active: true }).eq("owner_user_id", userId);
}

/** Revoke PM access after cancel / failed renewal. */
export async function deactivatePmModuleForAccount(admin: PmDb, userId: string): Promise<void> {
  await admin.from("pm_properties").update({ pm_module_active: false }).eq("owner_user_id", userId);
}

export async function requirePmModule(admin: PmDb, propertyId: string): Promise<void> {
  const { data: property } = await admin
    .from("pm_properties")
    .select("pm_module_active, owner_user_id")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    throw new PmModuleRequiredError();
  }

  // Prefer live subscription; property flag alone is not enough (prevents forever-free trials).
  const sub = await getActivePmSubscription(admin, property.owner_user_id);
  if (sub) {
    if (!property.pm_module_active) {
      await admin.from("pm_properties").update({ pm_module_active: true }).eq("id", propertyId);
    }
    return;
  }

  throw new PmModuleRequiredError();
}

/** Account-level gate for create / list-upsell flows. */
export async function requirePmModuleSubscription(admin: PmDb, userId: string): Promise<void> {
  const sub = await getActivePmSubscription(admin, userId);
  if (sub) return;

  throw new PmModuleRequiredError(
    "Property Management is not active on this account. Subscribe to unlock the module.",
  );
}

export async function userHasPmModuleAccess(admin: PmDb, userId: string): Promise<boolean> {
  try {
    await requirePmModuleSubscription(admin, userId);
    return true;
  } catch (e) {
    if (e instanceof PmModuleRequiredError) return false;
    throw e;
  }
}
