import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { phonesFromProperty } from "@/lib/contact-phones";
import { toWhatsAppDigits } from "@/lib/phone";

type Admin = SupabaseClient<Database>;

export type LinkByPhoneResult = {
  linkedCount: number;
  propertyIds: string[];
  matchedKeys: string[];
};

/** Canonical 254… keys from one or more raw phone strings. */
export function phoneMatchKeys(...rawPhones: Array<string | null | undefined>): Set<string> {
  const keys = new Set<string>();
  for (const raw of rawPhones) {
    if (!raw?.trim()) continue;
    const digits = toWhatsAppDigits(raw);
    if (digits) keys.add(digits);
  }
  return keys;
}

/** True when any listing contact phone normalizes into the applicant key set. */
export function listingMatchesPhoneKeys(
  property: {
    contact_phone?: string | null;
    contact_phones?: string[] | null;
  },
  applicantKeys: Set<string>,
): boolean {
  if (applicantKeys.size === 0) return false;
  for (const phone of phonesFromProperty(property)) {
    const digits = toWhatsAppDigits(phone);
    if (digits && applicantKeys.has(digits)) return true;
  }
  return false;
}

/**
 * Transfer admin-owned marketplace listings whose contact phones match the
 * approved lister onto their account. Never takes listings from non-admins.
 */
export async function linkAdminListingsByPhone(
  supabaseAdmin: Admin,
  input: {
    userId: string;
    organizationId: string | null;
    applicationPhone?: string | null;
    /** Approving admin for audit trail; falls back to userId when omitted. */
    auditAdminId?: string | null;
  },
): Promise<LinkByPhoneResult> {
  const empty: LinkByPhoneResult = { linkedCount: 0, propertyIds: [], matchedKeys: [] };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("phone")
    .eq("id", input.userId)
    .maybeSingle();

  let metadataPhone: string | null = null;
  try {
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(input.userId);
    const meta = authData.user?.user_metadata?.phone;
    if (typeof meta === "string") metadataPhone = meta;
  } catch (err) {
    console.warn("[link-by-phone] auth metadata phone lookup failed", err);
  }

  const applicantKeys = phoneMatchKeys(input.applicationPhone, profile?.phone, metadataPhone);
  if (applicantKeys.size === 0) return empty;

  const { data: adminRoles, error: adminErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (adminErr) {
    console.warn("[link-by-phone] admin roles lookup failed", adminErr.message);
    return empty;
  }

  const adminIds = [...new Set((adminRoles ?? []).map((r) => r.user_id).filter(Boolean))];
  if (adminIds.length === 0) return empty;

  const { data: candidates, error: listErr } = await supabaseAdmin
    .from("properties")
    .select("id, owner_id, contact_phone, contact_phones")
    .in("owner_id", adminIds)
    .eq("is_active", true);
  if (listErr) {
    console.warn("[link-by-phone] properties lookup failed", listErr.message);
    return empty;
  }

  const matches = (candidates ?? []).filter((row) => listingMatchesPhoneKeys(row, applicantKeys));
  if (matches.length === 0) return empty;

  const propertyIds: string[] = [];
  for (const row of matches) {
    const { error: updErr } = await supabaseAdmin
      .from("properties")
      .update({
        owner_id: input.userId,
        organization_id: input.organizationId,
      })
      .eq("id", row.id)
      .in("owner_id", adminIds);
    if (updErr) {
      console.warn(`[link-by-phone] failed to link ${row.id}`, updErr.message);
      continue;
    }
    propertyIds.push(row.id);
  }

  if (propertyIds.length > 0) {
    const matchedKeys = [...applicantKeys];
    try {
      await supabaseAdmin.from("admin_audit_logs").insert({
        admin_id: input.auditAdminId ?? input.userId,
        action: "PROPERTY_AUTO_LINKED_BY_PHONE",
        target_id: input.userId,
        details: `Auto-linked ${propertyIds.length} admin-owned listing(s) by phone (${matchedKeys.join(", ")}): ${propertyIds.join(", ")}`,
      });
    } catch (err) {
      console.warn("[link-by-phone] audit log failed", err);
    }
  }

  return {
    linkedCount: propertyIds.length,
    propertyIds,
    matchedKeys: [...applicantKeys],
  };
}
