import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { requireRole } from "@/lib/api/_authz";
import {
  listLandlordApplications,
  listTenantApplications,
  reviewRentalApplication,
  submitRentalApplication,
  withdrawRentalApplication,
} from "@/lib/rental-applications/core";

const submitSchema = z.object({
  propertyId: z.string().uuid(),
  message: z.string().trim().max(1000).optional(),
  moveInDate: z.string().trim().max(20).optional(),
  shareProfile: z.boolean().optional(),
});

export const submitPropertyApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(submitSchema)
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await submitRentalApplication(supabaseAdmin, userId, data);
    return row;
  });

export const withdrawPropertyApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ applicationId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return withdrawRentalApplication(supabaseAdmin, userId, data.applicationId);
  });

export const listMyPropertyApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return listTenantApplications(supabaseAdmin, userId);
  });

export const listLandlordPropertyApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return listLandlordApplications(supabaseAdmin, userId);
  });

export const reviewPropertyApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      applicationId: z.string().uuid(),
      status: z.enum(["under_review", "approved", "rejected"]),
      landlordNotes: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, ["landlord", "manager", "agency"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return reviewRentalApplication(supabaseAdmin, userId, data);
  });
