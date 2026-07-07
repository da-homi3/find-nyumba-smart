import { useQuery } from "@tanstack/react-query";
import { getAdminPromoDashboard } from "@/lib/api/promo.functions";
import { AdminAsyncPanel } from "@/components/admin/admin-shared";

export function AdminFoundingPromoTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-promo-dashboard"],
    queryFn: () => getAdminPromoDashboard(),
  });

  const campaigns = data?.campaigns ?? [];
  const pending = data?.pendingConversions ?? [];

  return (
    <AdminAsyncPanel
      loading={isLoading}
      loadingMessage="Loading founding member campaigns…"
      isEmpty={!isLoading && campaigns.length === 0}
      emptyContent={<p className="text-sm text-muted-foreground">No promo campaigns configured.</p>}
      skeletonCols={5}
    >
      <div className="space-y-8">
        <section>
          <h2 className="font-display text-lg font-semibold">Campaign slots</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-secondary/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Claimed</th>
                  <th className="px-4 py-3">Confirmed</th>
                  <th className="px-4 py-3">Remaining</th>
                  <th className="px-4 py-3">Bonus</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium capitalize">{c.role.replace("_", " ")}</td>
                    <td className="px-4 py-3">
                      {c.slots_claimed} / {c.max_slots}
                    </td>
                    <td className="px-4 py-3">{c.slots_confirmed}</td>
                    <td className="px-4 py-3">{Math.max(0, c.max_slots - c.slots_claimed)}</td>
                    <td className="px-4 py-3">+{c.bonus_listings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {typeof data?.forfeitedCount === "number" && data.forfeitedCount > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {data.forfeitedCount} forfeited slot(s) — released back to the pool.
            </p>
          )}
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Pending conversions (mid-trial)</h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No pending founding members.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b bg-secondary/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Slot</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Claimed</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-4 py-3">#{u.founding_member_slot_number}</td>
                      <td className="px-4 py-3">{u.full_name ?? "—"}</td>
                      <td className="px-4 py-3">{u.email ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {u.founding_member_claimed_at
                          ? new Date(u.founding_member_claimed_at).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminAsyncPanel>
  );
}
