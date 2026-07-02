import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isWhatsAppConfigured } from "@/lib/whatsapp/env";
import {
  notifyLandlordNewLead,
  notifyPaymentConfirmed,
} from "@/lib/whatsapp/templates";

type Admin = SupabaseClient<Database>;

function isWaPhone(phone: string | null | undefined): phone is string {
  return Boolean(phone?.startsWith("254"));
}

/** Notify tenant + landlord on WhatsApp after contact unlock payment. */
export async function notifyWhatsAppContactUnlock(
  admin: Admin,
  payment: Database["public"]["Tables"]["payments"]["Row"],
): Promise<void> {
  if (!isWhatsAppConfigured() || payment.payment_type !== "contact_unlock") return;

  const meta = payment.metadata as { wa_phone?: string } | null;
  const waPhone = meta?.wa_phone;

  if (isWaPhone(waPhone)) {
    await notifyPaymentConfirmed(
      waPhone,
      payment.amount_kes,
      payment.payment_method ?? "mpesa",
      "Contact unlocked",
      payment.mpesa_receipt ?? payment.id,
    ).catch((err) => console.warn("[whatsapp] payment notify failed:", err));
  }

  if (!payment.property_id) return;

  const { data: property } = await admin
    .from("properties")
    .select("title, neighborhood, owner_id, contact_phone")
    .eq("id", payment.property_id)
    .maybeSingle();
  if (!property?.owner_id) return;

  const { data: owner } = await admin
    .from("profiles")
    .select("phone, full_name")
    .eq("id", property.owner_id)
    .maybeSingle();

  const landlordPhone = owner?.phone ?? property.contact_phone;
  if (isWaPhone(landlordPhone)) {
    await notifyLandlordNewLead(landlordPhone, property.title, property.neighborhood).catch((err) =>
      console.warn("[whatsapp] lead notify failed:", err),
    );
  }
}

/** Notify landlord when listing goes active (call from admin/moderation flows). */
export async function notifyWhatsAppListingLive(
  admin: Admin,
  propertyId: string,
): Promise<void> {
  if (!isWhatsAppConfigured()) return;

  const { data: property } = await admin
    .from("properties")
    .select("title, owner_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property?.owner_id) return;

  const { data: owner } = await admin
    .from("profiles")
    .select("phone, full_name")
    .eq("id", property.owner_id)
    .maybeSingle();

  if (!isWaPhone(owner?.phone)) return;

  const { notifyListingApproved } = await import("@/lib/whatsapp/templates");
  await notifyListingApproved(
    owner.phone,
    owner.full_name?.split(" ")[0] ?? "there",
    property.title,
    propertyId,
  ).catch((err) => console.warn("[whatsapp] listing approved notify failed:", err));
}
