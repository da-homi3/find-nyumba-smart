import type { Property } from "@/lib/properties";
import { sendEmailNotification } from "@/lib/api/notify";

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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: searches, error } = await supabaseAdmin
    .from("saved_searches")
    .select("id, user_id, name, filters, criteria")
    .eq("alert_enabled", true);

  if (error || !searches?.length) return;

  const baseUrl = process.env.PUBLIC_APP_URL ?? "https://nyumba-search.kevinbuluma1.workers.dev";
  const propertyUrl = `${baseUrl}/tenant/property/${property.id}`;

  for (const search of searches) {
    const criteria = (search.criteria ?? search.filters ?? {}) as SearchCriteria;
    if (!matchesCriteria(property, criteria)) continue;

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(search.user_id);
    const email = userData.user?.email;
    if (!email) continue;

    await sendEmailNotification({
      to: email,
      subject: `New listing: ${property.title} — NyumbaSearch`,
      text: `A new listing matches your alert "${search.name}":\n\n${property.title}\n${property.neighborhood} · KES ${property.rent_kes.toLocaleString()}\n\nView: ${propertyUrl}`,
    });
  }
}
