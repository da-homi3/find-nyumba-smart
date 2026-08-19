import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PortalId } from "@/lib/portal-guard";
import type { PortalListerRole } from "@/lib/payments/portal-trial";
import { linkAdminListingsByPhone } from "@/lib/listings/link-by-phone";

type Admin = SupabaseClient<Database>;

function slugify(name: string) {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 48);
}

async function ensureOrganization(
  supabaseAdmin: Admin,
  input: {
    userId: string;
    organizationName: string;
    orgType: "agency" | "property_manager";
  },
): Promise<string | null> {
  const slug = `${slugify(input.organizationName)}-${input.userId.slice(0, 8)}`;
  const { data: existingMember } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", input.userId)
    .limit(1)
    .maybeSingle();

  if (existingMember?.organization_id) {
    return existingMember.organization_id;
  }

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: input.organizationName,
      slug,
      type: input.orgType,
    })
    .select("id")
    .single();

  const organizationId = org?.id ?? null;
  if (organizationId) {
    await supabaseAdmin.from("organization_members").insert({
      organization_id: organizationId,
      user_id: input.userId,
      role: "owner",
    });
  }
  return organizationId;
}

async function resolveOrganizationId(
  supabaseAdmin: Admin,
  input: {
    userId: string;
    requestedRole: PortalListerRole;
    organizationName?: string | null;
  },
): Promise<string | null> {
  if (!input.organizationName) return null;

  if (input.requestedRole === "agency") {
    return ensureOrganization(supabaseAdmin, {
      userId: input.userId,
      organizationName: input.organizationName,
      orgType: "agency",
    });
  }

  if (input.requestedRole === "manager") {
    return ensureOrganization(supabaseAdmin, {
      userId: input.userId,
      organizationName: input.organizationName,
      orgType: "property_manager",
    });
  }

  return null;
}

export async function grantPortalListerAccess(
  supabaseAdmin: Admin,
  input: {
    userId: string;
    requestedRole: PortalListerRole;
    organizationName?: string | null;
    startTrial?: boolean;
    /** Phone from the portal application — used to auto-link admin-owned listings. */
    applicationPhone?: string | null;
    /** Approving admin user id for audit logs. */
    reviewedByUserId?: string | null;
  },
): Promise<{
  organizationId: string | null;
  trialStarted: boolean;
  trialEnd?: string;
  linkedListings: number;
}> {
  // Bonus free month unlocks only after the first paid subscription month.
  // Unpaid auto-trials are disabled (`startTrial` is ignored if passed).

  await supabaseAdmin
    .from("user_roles")
    .upsert(
      { user_id: input.userId, role: input.requestedRole },
      { onConflict: "user_id,role", ignoreDuplicates: false },
    );

  await supabaseAdmin
    .from("user_roles")
    .upsert(
      { user_id: input.userId, role: "tenant" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

  const organizationId = await resolveOrganizationId(supabaseAdmin, input);

  const portalMap: Record<PortalListerRole, PortalId> = {
    landlord: "landlord",
    manager: "manager",
    agency: "agency",
  };

  await supabaseAdmin
    .from("profiles")
    .update({ active_portal: portalMap[input.requestedRole] })
    .eq("id", input.userId);

  const trialStarted = false;
  const trialEnd: string | undefined = undefined;

  let linkedListings = 0;
  try {
    const linked = await linkAdminListingsByPhone(supabaseAdmin, {
      userId: input.userId,
      organizationId,
      applicationPhone: input.applicationPhone,
      auditAdminId: input.reviewedByUserId,
    });
    linkedListings = linked.linkedCount;
    if (linkedListings > 0) {
      console.info(`[portal] auto-linked ${linkedListings} listing(s) to ${input.userId} by phone`);
    }
  } catch (err) {
    console.warn("[portal] listing auto-link by phone failed", err);
  }

  return { organizationId, trialStarted, trialEnd, linkedListings };
}
