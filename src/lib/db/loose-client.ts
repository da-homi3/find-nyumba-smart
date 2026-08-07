/**
 * Escape hatch for tables that are not yet in the generated `Database` types
 * (`pm_*`, `referrals`, and columns added after the last type generation).
 *
 * This is the single place allowed to widen the Supabase schema generic — regenerate
 * `src/integrations/supabase/types.ts` and use the typed client instead where possible.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- see module doc */
export type LooseDb = SupabaseClient<any>;

export function asLooseDb(client: unknown): LooseDb {
  return client as LooseDb;
}
