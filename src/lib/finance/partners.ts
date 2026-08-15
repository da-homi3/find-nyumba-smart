export type FinancialPartner = {
  id: string;
  name: string;
  product: string;
  status: "active" | "inactive";
  applicationUrl: string | null;
  disclosure: string | null;
  eligibility: string | null;
};

type PartnerRow = {
  id: unknown;
  name: unknown;
  product: unknown;
  status: unknown;
  application_url: unknown;
  disclosure: unknown;
  eligibility?: unknown;
};

function mapPartner(row: PartnerRow): FinancialPartner {
  return {
    id: String(row.id),
    name: String(row.name),
    product: String(row.product),
    status: row.status === "active" ? "active" : "inactive",
    applicationUrl: row.application_url ? String(row.application_url) : null,
    disclosure: row.disclosure ? String(row.disclosure) : null,
    eligibility: row.eligibility ? String(row.eligibility) : null,
  };
}

async function partnersTable() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asLooseDb } = await import("@/lib/db/loose-client");
  return asLooseDb(supabaseAdmin).from("financial_partners");
}

/** Partner catalog is DB-backed. Never hard-code a lender in the UI. */
export async function listActiveFinancialPartners(): Promise<FinancialPartner[]> {
  try {
    const { data, error } = await (await partnersTable())
      .select("id, name, product, status, application_url, disclosure, eligibility")
      .eq("status", "active")
      .order("name");
    if (error) {
      console.warn("[financial-partners]", error.message);
      return [];
    }
    return (data ?? []).map((row) => mapPartner(row as PartnerRow));
  } catch (err) {
    console.warn("[financial-partners]", err);
    return [];
  }
}

export async function listAllFinancialPartners(): Promise<FinancialPartner[]> {
  const { data, error } = await (await partnersTable())
    .select("id, name, product, status, application_url, disclosure, eligibility")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapPartner(row as PartnerRow));
}

export async function upsertFinancialPartner(input: {
  id?: string;
  name: string;
  product: string;
  status: "active" | "inactive";
  applicationUrl: string | null;
  disclosure: string | null;
  eligibility: string | null;
}): Promise<FinancialPartner> {
  const payload = {
    name: input.name,
    product: input.product,
    status: input.status,
    application_url: input.applicationUrl,
    disclosure: input.disclosure,
    eligibility: input.eligibility,
  };
  const table = await partnersTable();
  if (input.id) {
    const { data, error } = await table
      .update(payload)
      .eq("id", input.id)
      .select("id, name, product, status, application_url, disclosure, eligibility")
      .single();
    if (error) throw new Error(error.message);
    return mapPartner(data as PartnerRow);
  }
  const { data, error } = await table
    .insert(payload)
    .select("id, name, product, status, application_url, disclosure, eligibility")
    .single();
  if (error) throw new Error(error.message);
  return mapPartner(data as PartnerRow);
}

export async function setFinancialPartnerStatus(
  id: string,
  status: "active" | "inactive",
): Promise<void> {
  const { error } = await (await partnersTable()).update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}
