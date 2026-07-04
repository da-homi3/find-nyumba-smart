import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { approveAdvertiseInquiry, listAdvertiseInquiries } from "@/lib/api/partnership.functions";
import { ADVERTISE_PACKAGES } from "@/lib/revenue/plans";
import { formatKes } from "@/lib/properties";

export function AdminAdvertiseTab() {
  const qc = useQueryClient();
  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ["admin-advertise"],
    queryFn: () => listAdvertiseInquiries(),
  });

  const approve = useMutation({
    mutationFn: (inquiryId: string) => approveAdvertiseInquiry({ data: { inquiryId } }),
    onSuccess: (res) => {
      toast.success("Approval email sent with payment link");
      if (res.paymentLink) {
        void navigator.clipboard?.writeText(res.paymentLink).catch(() => undefined);
      }
      void qc.invalidateQueries({ queryKey: ["admin-advertise"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading advertise enquiries…</p>;
  }

  if (inquiries.length === 0) {
    return <p className="text-sm text-muted-foreground">No advertising enquiries yet.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review enquiries, then send an approval email with a payment link to the advertiser.
      </p>
      {inquiries.map((inq) => {
        const meta = (inq.metadata ?? {}) as Record<string, string>;
        const packageId = meta.package ?? "listing_banner";
        const pkg = ADVERTISE_PACKAGES.find((p) => p.id === packageId);
        const approved = meta.status === "approved";
        return (
          <article key={inq.id} className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-semibold">
                  {inq.company ?? "Company"} — {inq.contact_name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {inq.email ?? "No email"} · {inq.phone || "No phone"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pkg?.name ?? packageId}
                  {pkg ? ` · ${formatKes(pkg.priceKes)}` : ""}
                  {meta.budget ? ` · Budget ${meta.budget}` : ""}
                  {meta.website ? ` · ${meta.website}` : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  approved
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {approved ? "Approved" : "Pending"}
              </span>
            </div>
            <p className="mt-3 rounded-xl bg-secondary/50 p-3 text-sm">{inq.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={approve.isPending || !inq.email}
                onClick={() => approve.mutate(inq.id)}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {approved ? "Resend payment link" : "Approve & send payment link"}
              </button>
              <span className="text-xs text-muted-foreground">
                {new Date(inq.created_at).toLocaleString()}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
