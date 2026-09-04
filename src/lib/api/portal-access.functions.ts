import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { AppRole } from "@/lib/portal-guard";
import { evaluatePortalAccess, type GuardPortal } from "@/lib/route-guards/portal-access";
import { resolveRequestUserId } from "@/lib/route-guards/request-session";

const guardPortalSchema = z.enum(["landlord", "manager", "agency", "admin", "caretaker"]);

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

    let roles = new Set<AppRole>();
    let pendingApplications: Array<{ requested_role: string; status: string }> = [];

    if (userId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: roleRows }, { data: pendingRows }] = await Promise.all([
        supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
        supabaseAdmin
          .from("portal_applications")
          .select("requested_role, status")
          .eq("user_id", userId)
          .eq("status", "pending"),
      ]);
      roles = new Set((roleRows ?? []).map((row) => row.role as AppRole));
      pendingApplications = pendingRows ?? [];
    }

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
