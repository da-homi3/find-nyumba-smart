import { mobileError, mobileJson, requireMobileBearer } from "@/lib/api/mobile/v1/auth";
import { parseJsonBody, parseUuid, requireAdmin } from "@/lib/api/mobile/v1/helpers";
import { initiatePaymentSchema } from "@/lib/payments/initiate-payment-core";
import { z } from "zod";

function zodMessage(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join("; ") || "Invalid input";
}

const CHECKOUT_PAYMENT_TYPES = [
  "tenant_plus",
  "landlord_plan",
  "premium_subscription",
  "pm_module",
  "property_boost",
  "lead_pack",
  "provider_subscription",
  "verification",
] as const;

async function handleReviewEligibility(req: Request, propertyId: string): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const [{ data: completedViewing }, { data: tenancy }] = await Promise.all([
    auth.admin
      .from("viewings")
      .select("id")
      .eq("property_id", propertyId)
      .eq("tenant_id", auth.userId)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle(),
    auth.admin
      .from("tenancies")
      .select("id")
      .eq("property_id", propertyId)
      .eq("tenant_id", auth.userId)
      .in("status", ["active", "completed"])
      .limit(1)
      .maybeSingle(),
  ]);

  const eligible = Boolean(completedViewing || tenancy);
  return mobileJson({
    apiVersion: "v1",
    propertyId,
    eligible,
    reason: eligible
      ? null
      : "You can only review after a completed viewing or active/completed tenancy.",
    hasCompletedViewing: Boolean(completedViewing),
    hasTenancy: Boolean(tenancy),
  });
}

/**
 * Admin authenticity nudge. Trigger may recompute on later property updates.
 */
async function handleAdminAuthenticity(req: Request, propertyId: string): Promise<Response> {
  const gate = await requireAdmin(req);
  if (gate instanceof Response) return gate;

  const body = await parseJsonBody<{ score?: unknown; delta?: unknown }>(req);
  if (body instanceof Response) return body;

  const { data: row, error: loadErr } = await gate.admin
    .from("properties")
    .select("id, authenticity_score")
    .eq("id", propertyId)
    .maybeSingle();
  if (loadErr) return mobileError(loadErr.message, "ADMIN_ERROR", 500);
  if (!row) return mobileError("Property not found", "NOT_FOUND", 404);

  let next = row.authenticity_score ?? 70;
  if (typeof body.score === "number" && Number.isFinite(body.score)) {
    next = Math.trunc(body.score);
  } else if (typeof body.delta === "number" && Number.isFinite(body.delta)) {
    next = Math.trunc(next + body.delta);
  } else {
    return mobileError("score or delta required", "BAD_REQUEST", 400);
  }
  next = Math.max(0, Math.min(100, next));

  const { data: updated, error } = await gate.admin
    .from("properties")
    .update({ authenticity_score: next, updated_at: new Date().toISOString() })
    .eq("id", propertyId)
    .select("id, authenticity_score, title, neighborhood")
    .single();
  if (error) return mobileError(error.message, "ADMIN_ERROR", 500);

  return mobileJson({
    apiVersion: "v1",
    property: updated,
    authenticityScore: updated.authenticity_score,
  });
}

async function handlePaymentsInitiate(req: Request): Promise<Response> {
  const auth = await requireMobileBearer(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<Record<string, unknown>>(req);
  if (body instanceof Response) return body;

  const paymentType = body.paymentType;
  if (
    typeof paymentType !== "string" ||
    !(CHECKOUT_PAYMENT_TYPES as readonly string[]).includes(paymentType)
  ) {
    return mobileError(
      "paymentType must be tenant_plus|landlord_plan|premium_subscription|pm_module|property_boost|lead_pack|provider_subscription|verification",
      "BAD_REQUEST",
      400,
    );
  }

  const defaultSuccessPath = paymentType === "tenant_plus" ? "/plus" : "/portals";
  const payload = {
    ...body,
    paymentType,
    successPath:
      typeof body.successPath === "string" && body.successPath.trim()
        ? body.successPath.trim()
        : defaultSuccessPath,
  };

  const parsed = initiatePaymentSchema.safeParse(payload);
  if (!parsed.success) {
    return mobileError(zodMessage(parsed.error), "BAD_REQUEST", 400);
  }

  try {
    const { initiatePaymentCore } = await import("@/lib/payments/initiate-payment-core");
    const result = await initiatePaymentCore(auth.userId, parsed.data);
    return mobileJson({ apiVersion: "v1", ...result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return mobileError(zodMessage(err), "BAD_REQUEST", 400);
    }
    const message = err instanceof Error ? err.message : "Payment initiate failed";
    return mobileError(message, "BAD_REQUEST", 400);
  }
}

/**
 * Wave 17 Mobile BFF — review eligibility, authenticity admin, payments initiate.
 */
export async function tryHandleWave17(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  const eligibility = /^\/listings\/([^/]+)\/reviews\/eligibility$/.exec(rest);
  if (eligibility && method === "GET") {
    const id = parseUuid(eligibility[1]);
    if (!id) return mobileError("Invalid listing id", "BAD_REQUEST", 400);
    return handleReviewEligibility(req, id);
  }

  const authenticity = /^\/admin\/properties\/([^/]+)\/authenticity$/.exec(rest);
  if (authenticity && method === "PATCH") {
    const id = parseUuid(authenticity[1]);
    if (!id) return mobileError("Invalid property id", "BAD_REQUEST", 400);
    return handleAdminAuthenticity(req, id);
  }

  if (rest === "/payments/initiate" && method === "POST") {
    return handlePaymentsInitiate(req);
  }

  return null;
}
