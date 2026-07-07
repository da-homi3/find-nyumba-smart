import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/api/_authz";
import { getAuthContext } from "@/lib/api/server-context";
import { withCache } from "@/lib/cache/manager";
import type { PromoEligibleRole } from "@/lib/promo/constants";

export type PromoStatusMap = Partial<
  Record<PromoEligibleRole, { remaining: number; total: number; confirmed: number }>
>;

async function loadPromoStatus(): Promise<PromoStatusMap> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("promo_campaigns")
    .select("role, max_slots, slots_claimed, slots_confirmed, active")
    .eq("active", true);

  if (error) throw error;

  const acc: PromoStatusMap = {};
  for (const row of data ?? []) {
    const role = row.role as PromoEligibleRole;
    acc[role] = {
      remaining: Math.max(0, row.max_slots - row.slots_claimed),
      total: row.max_slots,
      confirmed: row.slots_confirmed,
    };
  }
  return acc;
}

/** Public founding-member slot counts (cached ~90s). */
export const getPromoStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await withCache("promo_status", "promo_status", loadPromoStatus);
  return data;
});

export const getAdminPromoDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuthContext(context);
    await requireRole(supabase, userId, "admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: campaigns }, { data: pendingProfiles }, { count: forfeitedCount }] =
      await Promise.all([
        supabaseAdmin.from("promo_campaigns").select("*").order("role"),
        supabaseAdmin
          .from("profiles")
          .select(
            "id, full_name, founding_member_slot_number, founding_member_claimed_at, founding_member_campaign_id",
          )
          .eq("founding_member_status", "pending")
          .order("founding_member_claimed_at", { ascending: true }),
        supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("founding_member_status", "forfeited"),
      ]);

    const pendingWithEmail = await Promise.all(
      (pendingProfiles ?? []).map(async (p) => {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id);
        return {
          ...p,
          email: authUser.user?.email ?? null,
          role: authUser.user?.user_metadata?.role as string | undefined,
        };
      }),
    );

    return {
      campaigns: campaigns ?? [],
      pendingConversions: pendingWithEmail,
      forfeitedCount: forfeitedCount ?? 0,
    };
  });

/** HTTP handler for GET /api/promo/status */
export async function handlePromoStatusApi(): Promise<Response> {
  try {
    const { data: status } = await withCache("promo_status", "promo_status", loadPromoStatus);
    return new Response(JSON.stringify(status), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=90, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    console.error("[promo] status error:", err);
    return new Response(JSON.stringify({}), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
