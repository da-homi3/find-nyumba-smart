import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreLeadQuality, type LeadSource } from "@/lib/revenue/leads";

export async function recordLead(
  supabaseAdmin: SupabaseClient<Database>,
  args: {
    listingId: string;
    landlordId: string;
    tenantId: string;
    source: LeadSource;
  },
) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, phone, avatar_url")
    .eq("id", args.tenantId)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("leads").upsert(
    {
      listing_id: args.listingId,
      landlord_id: args.landlordId,
      tenant_id: args.tenantId,
      source: args.source,
      quality_score: scoreLeadQuality(profile),
    },
    { onConflict: "listing_id,tenant_id,source", ignoreDuplicates: false },
  );

  if (error && !error.message.includes("does not exist")) {
    console.error("recordLead:", error.message);
  }
}
