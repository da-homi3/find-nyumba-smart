import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AuthServerContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

export function getAuthContext(context: unknown): AuthServerContext {
  if (typeof context !== "object" || context === null) {
    throw new Error("Unauthorized");
  }
  const { supabase, userId } = context as AuthServerContext;
  if (!supabase || !userId) throw new Error("Unauthorized");
  return { supabase, userId };
}

export function profileFromMap<T>(id: string | null | undefined, map: Map<string, T>): T | null {
  if (!id) return null;
  return map.get(id) ?? null;
}

export function firstRegexMatch(text: string, pattern: RegExp): string | null {
  return pattern.exec(text)?.[0] ?? null;
}

export const JSON_ARRAY_RE = /\[[\s\S]*\]/;
export const JSON_OBJECT_RE = /\{[\s\S]*\}/;
