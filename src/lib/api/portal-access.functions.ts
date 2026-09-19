import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { AppRole } from "@/lib/portal-guard";
import { evaluatePortalAccess, type GuardPortal } from "@/lib/route-guards/portal-access";
import { resolveRequestUserId } from "@/lib/route-guards/request-session";

const guardPortalSchema = z.enum([
  "landlord",
  "manager",
  "agency",
  "property_developer",
  "agent",
  "admin",
  "caretaker",
]);

export const resolvePortalRouteAccess = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      portal: guardPortalSchema,
      pathname: z.string().min(1).max(512),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    const userId = request ? await resolveRequestUserId(request) : null;

    // Session is stored in localStorage on the client. Document SSR requests usually have no
    // Bearer/cookie — fail open and let the client layout guard enforce roles.
    if (!userId) {
      return { allowed: true as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: roleRows }, { data: pendingRows }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin
        .from("portal_applications")
        .select("requested_role, status")
        .eq("user_id", userId)
        .eq("status", "pending"),
    ]);
    const roles = new Set((roleRows ?? []).map((row) => row.role as AppRole));
    const pendingApplications = pendingRows ?? [];

    const decision = evaluatePortalAccess({
      portal: data.portal as GuardPortal,
      pathname: data.pathname,
      roles,
      userId,
      pendingApplications,
    });

    if (decision.allowed) {
      return { allowed: true as const };
    }

    return {
      allowed: false as const,
      redirect: {
        to: decision.redirectTo,
        search: decision.redirectSearch,
      },
    };
  });
