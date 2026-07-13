import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PortalId } from "@/lib/portal-guard";
import { autoStartPortalTrial, type PortalListerRole } from "@/lib/payments/portal-trial";

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
  },
): Promise<{ organizationId: string | null; trialStarted: boolean; trialEnd?: string }> {
  const startTrial = input.startTrial !== false;

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

  let trialStarted = false;
  let trialEnd: string | undefined;
  if (startTrial) {
    const trial = await autoStartPortalTrial(supabaseAdmin, input.userId, input.requestedRole);
    trialStarted = trial.started;
    trialEnd = trial.trialEnd;
  }

  return { organizationId, trialStarted, trialEnd };
}
