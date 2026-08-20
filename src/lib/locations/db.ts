import type { SupabaseClient } from "@supabase/supabase-js";

/** Locations tables are not yet in generated Database types — use untyped client. */
export type LocationsDb = SupabaseClient;
