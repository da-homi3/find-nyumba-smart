import { mobileError, mobileJson } from "@/lib/api/mobile/v1/auth";
import { parseJsonBody, requireAdmin } from "@/lib/api/mobile/v1/helpers";
import { ADVERTISE_PACKAGES } from "@/lib/revenue/plans";
import { formatKes } from "@/lib/properties";
import { getSiteUrl } from "@/lib/site";
import { z } from "zod";

function zodMessage(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join("; ") || "Invalid input";
}

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(5000),
  ctaLabel: z.string().trim().min(2).max(80).default("Learn more"),
  ctaUrl: z.string().trim().url().max(500),
  targetRoles: z
    .array(z.enum(["tenant", "landlord", "agency", "manager", "all"]))
    .min(1)
    .max(5)
    .default(["all"]),
});

async function handleAdminAnnounce(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<unknown>(req);
  if (body instanceof Response) return body;
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) return mobileError(zodMessage(parsed.error), "VALIDATION", 400);

  try {
    const { sendProductAnnouncement } = await import("@/lib/cron/announcements");
    const result = await sendProductAnnouncement(auth.admin, parsed.data, auth.userId);
    return mobileJson({ apiVersion: "v1", ...result });
  } catch (err) {
    console.error("[wave20] announce", err);
    return mobileError(
      err instanceof Error ? err.message : "Announcement failed",
      "ANNOUNCE_FAILED",
      400,
    );
  }
}

async function handleAdminPromo(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  try {
    const [{ data: campaigns }, { data: pendingProfiles }, { count: forfeitedCount }] =
      await Promise.all([
        auth.admin.from("promo_campaigns").select("*").order("role"),
        auth.admin
          .from("profiles")
          .select(
            "id, full_name, founding_member_slot_number, founding_member_claimed_at, founding_member_campaign_id",
          )
          .eq("founding_member_status", "pending")
          .order("founding_member_claimed_at", { ascending: true }),
        auth.admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("founding_member_status", "forfeited"),
      ]);

    const pendingConversions = await Promise.all(
      (pendingProfiles ?? []).map(async (p) => {
        const { data: authUser } = await auth.admin.auth.admin.getUserById(p.id);
        return {
          ...p,
          email: authUser.user?.email ?? null,
          role: authUser.user?.user_metadata?.role as string | undefined,
        };
      }),
    );

    return mobileJson({
      apiVersion: "v1",
      campaigns: campaigns ?? [],
      pendingConversions,
      forfeitedCount: forfeitedCount ?? 0,
    });
  } catch (err) {
    console.error("[wave20] promo", err);
    return mobileError("Could not load promo dashboard", "INTERNAL", 500);
  }
}

async function handleAdminAdvertiseList(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  try {
    const { data, error } = await auth.admin
      .from("partnership_inquiries")
      .select("*")
      .eq("inquiry_type", "advertise")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return mobileJson({ apiVersion: "v1", items: data ?? [] });
  } catch (err) {
    console.error("[wave20] advertise list", err);
    return mobileError("Could not load advertise inquiries", "INTERNAL", 500);
  }
}

async function handleAdminAdvertiseApprove(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody<{
    inquiryId?: string;
    packageId?: string;
    amountKes?: number;
    notes?: string;
  }>(req);
  if (body instanceof Response) return body;
  const inquiryId = body.inquiryId?.trim();
  if (!inquiryId) return mobileError("inquiryId required", "VALIDATION", 400);

  try {
    const { sendEmailResult } = await import("@/lib/email/send");
    const { CUSTOMER_CARE_EMAIL } = await import("@/lib/site");
    const site = getSiteUrl();

    const { data: inquiry, error } = await auth.admin
      .from("partnership_inquiries")
      .select("*")
      .eq("id", inquiryId)
      .eq("inquiry_type", "advertise")
      .maybeSingle();
    if (error) throw error;
    if (!inquiry) return mobileError("Inquiry not found", "NOT_FOUND", 404);

    const meta = (inquiry.metadata ?? {}) as Record<string, string>;
    const packageId = body.packageId ?? meta.package ?? "listing_banner";
    const pkg = ADVERTISE_PACKAGES.find((p) => p.id === packageId) ?? ADVERTISE_PACKAGES[0];
    const amountKes = body.amountKes ?? pkg.priceKes;
    const checkoutToken = meta.checkoutToken || crypto.randomUUID();
    const payUrl = `${site}/advertise/pay?package=${pkg.id}&ref=${inquiry.id}&t=${checkoutToken}`;
    const submitterEmail = inquiry.email;
    if (!submitterEmail?.includes("@")) {
      return mobileError("Inquiry has no email for approval", "VALIDATION", 400);
    }

    const firstName = (inquiry.contact_name ?? "there").split(/\s+/)[0];
    const notesLine = body.notes?.trim() ? `\nNotes: ${body.notes.trim()}\n` : "";
    const text = [
      `Hi ${firstName},`,
      "",
      "Great news — your NyumbaSearch ad package is approved.",
      "",
      `Package: ${pkg.name}`,
      `Amount: ${formatKes(amountKes)}`,
      `Company: ${inquiry.company ?? "—"}`,
      notesLine,
      "To activate your ads, complete payment (this link is unique to you):",
      payUrl,
      "",
      "Your ads will go live within 48 hours of payment confirmation.",
      "",
      `Pay by M-Pesa or card. Questions? ${CUSTOMER_CARE_EMAIL}`,
    ]
      .filter((line) => line !== undefined)
      .join("\n");

    const emailResult = await sendEmailResult({
      to: submitterEmail,
      subject: "Your NyumbaSearch ad package is ready — pay to go live",
      text,
      html: text.replaceAll("\n", "<br>"),
      templateId: "advertise-approved",
    });

    await auth.admin
      .from("partnership_inquiries")
      .update({
        metadata: {
          ...meta,
          package: pkg.id,
          packageAmount: String(amountKes),
          paymentLink: payUrl,
          checkoutToken,
          status: "approved",
          approvedAt: new Date().toISOString(),
        } as Record<string, string>,
      })
      .eq("id", inquiry.id);

    return mobileJson({
      apiVersion: "v1",
      ok: emailResult.ok,
      paymentLink: payUrl,
      emailError: emailResult.ok ? undefined : emailResult.reason,
    });
  } catch (err) {
    console.error("[wave20] advertise approve", err);
    return mobileError(
      err instanceof Error ? err.message : "Approve failed",
      "APPROVE_FAILED",
      400,
    );
  }
}

/** Wave 20 — admin announce, founding promo, advertise review. */
export async function tryHandleWave20(
  req: Request,
  rest: string,
  method: string,
): Promise<Response | null> {
  if (method === "POST" && rest === "/admin/announcements") return handleAdminAnnounce(req);
  if (method === "GET" && rest === "/admin/promo") return handleAdminPromo(req);
  if (method === "GET" && rest === "/admin/advertise") return handleAdminAdvertiseList(req);
  if (method === "POST" && rest === "/admin/advertise/approve") {
    return handleAdminAdvertiseApprove(req);
  }
  return null;
}
