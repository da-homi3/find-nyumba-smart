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

/**
 * Paid marketplace portal plan (landlord / manager / agency) unlocks PM for free.
 * Trialling and free plans do not qualify — the 1% rent fee still always applies.
 */
export async function hasPaidMarketplacePortalAccess(
  admin: PmDb,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("subscriptions")
    .select("plan, status, next_billing_date, module, amount_kes")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);

  const now = Date.now();
  for (const row of data ?? []) {
    const module = (row as { module?: string }).module ?? "marketplace";
    if (module !== "marketplace") continue;
    if (new Date(row.next_billing_date).getTime() <= now) continue;
    const plan = String(row.plan ?? "");
    if (!plan || plan === "free" || plan === "plus") continue;
    // Zero-amount comps / unpaid grants do not count as paid.
    if (Number(row.amount_kes ?? 0) <= 0) continue;
    return true;
  }
  return false;
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

/** Revoke PM access after cancel / failed renewal (unless marketplace plan still includes PM). */
export async function deactivatePmModuleForAccount(admin: PmDb, userId: string): Promise<void> {
  if (await hasPaidMarketplacePortalAccess(admin, userId)) {
    await activatePmModuleForAccount(admin, userId);
    return;
  }
  await admin.from("pm_properties").update({ pm_module_active: false }).eq("owner_user_id", userId);
}

async function grantPmIfEntitled(admin: PmDb, userId: string, propertyId?: string): Promise<boolean> {
  const sub = await getActivePmSubscription(admin, userId);
  if (sub) {
    if (propertyId) {
      await admin.from("pm_properties").update({ pm_module_active: true }).eq("id", propertyId);
    } else {
      await activatePmModuleForAccount(admin, userId);
    }
    return true;
  }

  if (await hasPaidMarketplacePortalAccess(admin, userId)) {
    if (propertyId) {
      await admin.from("pm_properties").update({ pm_module_active: true }).eq("id", propertyId);
    } else {
      await activatePmModuleForAccount(admin, userId);
    }
    return true;
  }

  return false;
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

  // Prefer live PM sub or paid marketplace portal plan; property flag alone is not enough.
  if (await grantPmIfEntitled(admin, property.owner_user_id, propertyId)) {
    return;
  }

  throw new PmModuleRequiredError();
}

/** Account-level gate for create / list-upsell flows. */
export async function requirePmModuleSubscription(admin: PmDb, userId: string): Promise<void> {
  if (await grantPmIfEntitled(admin, userId)) return;

  throw new PmModuleRequiredError(
    "Property Management is not active on this account. Subscribe to unlock the module, or upgrade your marketplace plan.",
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
