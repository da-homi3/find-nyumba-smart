import { getCacheKv } from "@/lib/kv/bindings";

const INVITE_TTL_SECONDS = 60 * 60 * 24 * 14;
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

export type PmTenantInviteRecord = {
  tenantId: string;
  existingUserId: string | null;
  propertyId: string;
};

function keyFor(token: string): string {
  return `tenant_invite:${token}`;
}

export async function storePmTenantInvite(
  token: string,
  record: PmTenantInviteRecord,
): Promise<void> {
  const payload = JSON.stringify(record);
  const kv = getCacheKv();
  if (kv) {
    await kv.put(keyFor(token), payload, { expirationTtl: INVITE_TTL_SECONDS });
    return;
  }
  memoryStore.set(keyFor(token), {
    value: payload,
    expiresAt: Date.now() + INVITE_TTL_SECONDS * 1000,
  });
}

export async function readPmTenantInvite(token: string): Promise<PmTenantInviteRecord | null> {
  const key = keyFor(token);
  const kv = getCacheKv();
  if (kv) {
    const raw = await kv.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PmTenantInviteRecord;
    } catch {
      return null;
    }
  }
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  try {
    return JSON.parse(entry.value) as PmTenantInviteRecord;
  } catch {
    return null;
  }
}

export async function deletePmTenantInvite(token: string): Promise<void> {
  const key = keyFor(token);
  const kv = getCacheKv();
  if (kv) {
    await kv.delete(key);
  }
  memoryStore.delete(key);
}
