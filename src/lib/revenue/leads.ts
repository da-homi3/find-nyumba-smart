import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "full_name" | "phone" | "avatar_url"
>;

export type LeadSource = "view" | "save" | "message" | "booking";

export function scoreLeadQuality(profile: ProfileRow | null): number {
  if (!profile) return 2;
  let score = 3;
  if (profile.full_name?.trim()) score += 1;
  if (profile.phone?.trim()) score += 1;
  if (profile.avatar_url) score += 0;
  return Math.min(5, score);
}
