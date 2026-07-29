import type { SupabaseClient } from "@supabase/supabase-js";
import { phonesFromProperty } from "@/lib/contact-phones";

export type AdminContactSuggestion = {
  name: string;
  phones: string[];
  count: number;
};

type ContactRow = {
  contact_name: string | null;
  contact_phone: string | null;
  contact_phones: string[] | null;
};

const MAX_CONTACT_PHONES_SUGGEST = 5;

function contactFromAuditDetails(detailsJson: string): ContactRow | null {
  try {
    const details = JSON.parse(detailsJson) as Record<string, unknown>;
    const name = typeof details.contact_name === "string" ? details.contact_name : null;
    const phone = typeof details.contact_phone === "string" ? details.contact_phone : null;
    const phones = Array.isArray(details.contact_phones)
      ? (details.contact_phones as string[])
      : null;
    if (!name && !phone && !(phones && phones.length > 0)) return null;
    return { contact_name: name, contact_phone: phone, contact_phones: phones };
  } catch {
    return null;
  }
}

function phoneKey(phone: string): string {
  return phone.replaceAll(/\s+/g, "");
}

function tallyContactRows(rows: ContactRow[]): {
  byName: Map<string, { name: string; phones: Set<string>; count: number }>;
  phoneCounts: Map<string, number>;
  formatLookup: Map<string, string>;
} {
  const byName = new Map<string, { name: string; phones: Set<string>; count: number }>();
  const phoneCounts = new Map<string, number>();
  const formatLookup = new Map<string, string>();

  for (const row of rows) {
    const phones = phonesFromProperty(row);
    for (const phone of phones) {
      const key = phoneKey(phone);
      phoneCounts.set(key, (phoneCounts.get(key) ?? 0) + 1);
      if (!formatLookup.has(key)) formatLookup.set(key, phone);
    }
    const name = row.contact_name?.trim() ?? "";
    if (name.length < 2) continue;
    const nameKey = name.toLowerCase();
    const existing = byName.get(nameKey);
    if (existing) {
      existing.count += 1;
      for (const p of phones) existing.phones.add(p);
    } else {
      byName.set(nameKey, { name, phones: new Set(phones), count: 1 });
    }
  }

  return { byName, phoneCounts, formatLookup };
}

export function aggregateContactSuggestions(rows: ContactRow[]): {
  contacts: AdminContactSuggestion[];
  phones: string[];
} {
  const { byName, phoneCounts, formatLookup } = tallyContactRows(rows);

  const contacts: AdminContactSuggestion[] = [...byName.values()]
    .map((a) => ({
      name: a.name,
      phones: [...a.phones].slice(0, MAX_CONTACT_PHONES_SUGGEST),
      count: a.count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 12);

  const seenInContacts = new Set(contacts.flatMap((c) => c.phones.map(phoneKey)));

  const phones = [...phoneCounts.entries()]
    .filter(([key]) => !seenInContacts.has(key))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key]) => formatLookup.get(key) ?? key);

  return { contacts, phones };
}

export async function loadAdminContactRows(
  admin: SupabaseClient,
  adminId: string,
): Promise<ContactRow[]> {
  const { data: owned } = await admin
    .from("properties")
    .select("contact_name, contact_phone, contact_phones")
    .eq("owner_id", adminId)
    .order("updated_at", { ascending: false })
    .limit(300);

  const { data: audits } = await admin
    .from("admin_audit_logs")
    .select("target_id, details")
    .eq("admin_id", adminId)
    .in("action", ["PROPERTY_CREATED_BY_ADMIN", "PROPERTY_CREATED_ON_BEHALF"])
    .order("created_at", { ascending: false })
    .limit(200);

  const rows: ContactRow[] = [...(owned ?? [])];

  const propertyIds = [
    ...new Set(
      (audits ?? [])
        .map((a) => a.target_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ].slice(0, 150);

  if (propertyIds.length > 0) {
    const { data: created } = await admin
      .from("properties")
      .select("contact_name, contact_phone, contact_phones")
      .in("id", propertyIds);
    rows.push(...(created ?? []));
  }

  for (const audit of audits ?? []) {
    if (!audit.details) continue;
    const fromAudit = contactFromAuditDetails(audit.details);
    if (fromAudit) rows.push(fromAudit);
  }

  return rows;
}
