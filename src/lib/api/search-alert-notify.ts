import type { Property } from "@/lib/properties";
import { getSiteUrl } from "@/lib/site";
import { sendEmail } from "@/lib/email/send";
import { newListingsAlertEmail } from "@/lib/email/templates";
import { shouldSendMarketingEmail } from "@/lib/email/prefs";

type SearchCriteria = {
  neighborhood?: string;
  propertyType?: string;
  maxBudget?: number;
  frequency?: string;
};

function matchesCriteria(property: Property, criteria: SearchCriteria): boolean {
  if (criteria.neighborhood) {
    const hood = criteria.neighborhood.toLowerCase();
    if (!property.neighborhood?.toLowerCase().includes(hood)) return false;
  }
  if (criteria.propertyType && criteria.propertyType !== "any") {
    if (property.property_type !== criteria.propertyType) return false;
  }
  if (criteria.maxBudget != null && property.rent_kes > criteria.maxBudget) return false;
  return true;
}

/** Notify tenants with matching saved-search alerts when a new listing goes live. */
export async function notifyMatchingSearchAlerts(property: Property): Promise<void> {
  if (!property.is_active) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: searches, error } = await supabaseAdmin
    .from("saved_searches")
    .select("id, user_id, name, filters, criteria")
    .eq("alert_enabled", true);

  if (error || !searches?.length) return;

  const baseUrl = getSiteUrl();
  const propertyUrl = `${baseUrl}/tenant/property/${property.id}`;
  const now = new Date().toISOString();

  for (const search of searches) {
    const criteria = (search.criteria ?? search.filters ?? {}) as SearchCriteria;
    if (!matchesCriteria(property, criteria)) continue;

    if (!(await shouldSendMarketingEmail(supabaseAdmin, search.user_id))) continue;

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(search.user_id);
    const email = userData.user?.email;
    if (!email) continue;

    const tpl = newListingsAlertEmail({
      alertName: search.name ?? "Saved search",
      listings: [
        {
          title: property.title,
          neighborhood: property.neighborhood ?? "Nairobi",
          priceKes: property.rent_kes,
          url: propertyUrl,
        },
      ],
      browseUrl: `${baseUrl}/tenant`,
    });
    const sent = await sendEmail({
      to: email,
      templateId: "new-listings-alert",
      ...tpl,
      metadata: { userId: search.user_id, searchId: search.id, propertyId: property.id },
    });
    if (sent) {
      await supabaseAdmin
        .from("saved_searches")
        .update({ last_notified_at: now })
        .eq("id", search.id);
    }
  }
}
