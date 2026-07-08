import { ForbiddenError } from "@/lib/api/_authz";

export function duplicateListingMessage(ownedBySameAccount: boolean): string {
  return ownedBySameAccount
    ? "You've already listed this property. Edit your existing listing instead of posting a copy."
    : "This property is already listed on NyumbaSearch. To keep listings credible and unique, each property can only be listed once.";
}

export function isListingDuplicateDbError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const row = error as { code?: string; message?: string; details?: string };
  if (row.code !== "23505") return false;
  const text = `${row.message ?? ""} ${row.details ?? ""}`.toLowerCase();
  return (
    text.includes("duplicate_hash") || text.includes("idx_properties_duplicate_hash_active_unique")
  );
}

export function throwIfListingDuplicateDbError(
  error: unknown,
  ownedBySameAccount = false,
): never | void {
  if (!isListingDuplicateDbError(error)) return;
  throw new ForbiddenError(duplicateListingMessage(ownedBySameAccount));
}
