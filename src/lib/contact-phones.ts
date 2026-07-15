/** Max listing contact numbers allowed on create/edit. */
export const MAX_CONTACT_PHONES = 5;

/** Normalize raw phone inputs into a unique ordered list. */
export function normalizeContactPhones(
  phones?: readonly (string | null | undefined)[] | null,
  primary?: string | null,
): string[] {
  const raw = [...(phones ?? []), primary ?? ""];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const phone = entry?.trim() ?? "";
    if (phone.length < 9) continue;
    const key = phone.replaceAll(/\s+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phone);
    if (out.length >= MAX_CONTACT_PHONES) break;
  }
  return out;
}

/** Dual-write fields for properties insert/update. */
export function contactPhoneFields(phones: string[]): {
  contact_phone: string | null;
  contact_phones: string[];
} {
  const normalized = normalizeContactPhones(phones);
  return {
    contact_phone: normalized[0] ?? null,
    contact_phones: normalized,
  };
}

/** Load phones from a property row (array + legacy primary). */
export function phonesFromProperty(row: {
  contact_phone?: string | null;
  contact_phones?: string[] | null;
}): string[] {
  return normalizeContactPhones(row.contact_phones, row.contact_phone);
}
