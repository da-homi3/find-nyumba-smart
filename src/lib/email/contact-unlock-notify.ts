import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getSiteUrl } from "@/lib/site";
import { sendEmail } from "@/lib/email/send";
import { contactUnlockEmail, newLeadEmail } from "@/lib/email/templates";

type Admin = SupabaseClient<Database>;

function methodLabel(method: "trial" | "plus" | "paid", paidMethod?: string): string {
  if (method === "trial") return "Free trial unlock";
  if (method === "plus") return "NyumbaSearch Plus";
  return paidMethod ?? "M-Pesa";
}

async function loadUserContext(admin: Admin, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  const user = data.user;
  if (!user?.email) return null;
  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email.split("@")[0];
  return { email: user.email, name, firstName: name.split(" ")[0] ?? name };
}

async function loadProperty(admin: Admin, listingId: string) {
  const { data } = await admin
    .from("properties")
    .select("id, title, neighborhood, contact_phone, owner_id, rent_kes")
    .eq("id", listingId)
    .maybeSingle();
  return data;
}

async function resolveContactPhone(
  admin: Admin,
  property: NonNullable<Awaited<ReturnType<typeof loadProperty>>>,
): Promise<string | null> {
  if (property.contact_phone?.trim()) return property.contact_phone.trim();
  if (!property.owner_id) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", property.owner_id)
    .maybeSingle();
  return profile?.phone?.trim() ?? null;
}

/** Send tenant unlock confirmation + landlord lead email (trial, plus, or paid). */
export async function notifyContactUnlockEmails(
  admin: Admin,
  opts: {
    userId: string;
    listingId: string;
    method: "trial" | "plus" | "paid";
    feeKes?: number;
    paidMethod?: string;
  },
): Promise<void> {
  const user = await loadUserContext(admin, opts.userId);
  const property = await loadProperty(admin, opts.listingId);
  if (!user || !property) return;

  const contactPhone = await resolveContactPhone(admin, property);
  const base = getSiteUrl();
  const listingUrl = `${base}/tenant/property/${property.id}`;
  const fee = opts.feeKes ?? 0;

  if (contactPhone) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email_transactional_opt_in")
      .eq("id", opts.userId)
      .maybeSingle();
    if (profile?.email_transactional_opt_in === false) return;

    const { data: spendRows } = await admin
      .from("contact_unlocks")
      .select("fee_charged")
      .eq("user_id", opts.userId)
      .eq("method", "paid")
      .gte(
        "unlocked_at",
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      );
    const monthlySpend = (spendRows ?? []).reduce((s, r) => s + (r.fee_charged ?? 0), 0);

    const tpl = contactUnlockEmail({
      name: user.name,
      listingTitle: property.title,
      neighborhood: property.neighborhood ?? "Nairobi",
      contactPhone,
      feeKes: fee,
      method: methodLabel(opts.method, opts.paidMethod),
      listingUrl,
      plusUrl: `${base}/tenant/checkout?plan=plus`,
      showPlusUpsell: opts.method === "paid" && monthlySpend >= 400,
    });
    await sendEmail({
      to: user.email,
      templateId: "contact-unlock",
      ...tpl,
      metadata: { userId: opts.userId, listingId: opts.listingId, method: opts.method },
    });
  }

  if (property.owner_id && property.owner_id !== opts.userId) {
    const landlord = await loadUserContext(admin, property.owner_id);
    if (landlord) {
      const tpl = newLeadEmail({
        landlordName: landlord.name,
        tenantFirstName: user.firstName,
        listingTitle: property.title,
        neighborhood: property.neighborhood ?? "Nairobi",
        timestamp: new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }),
        leadsUrl: `${base}/landlord/leads`,
      });
      await sendEmail({
        to: landlord.email,
        templateId: "new-lead",
        ...tpl,
        metadata: { landlordId: property.owner_id, listingId: opts.listingId },
      });
    }
  }
}
