import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, Gift, Users, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getMyReferralInfo } from "@/lib/api/referral.functions";
import { SiteNav } from "@/components/SiteNav";

export const Route = createFileRoute("/referrals")({
  head: () => ({ meta: [{ title: "Invite & Earn — NyumbaSearch" }] }),
  component: ReferralDashboard,
});

function ReferralDashboard() {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-referrals"],
    queryFn: () => getMyReferralInfo(),
    enabled: !!user,
    staleTime: 60_000,
  });

  if (authLoading || isLoading) {
    return (
      <>
        <SiteNav />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-xl px-4 py-20 text-center">
          <p className="text-white/50">Sign in to access your referral dashboard.</p>
        </div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-red-400">
          Failed to load referral data. Try refreshing.
        </div>
      </>
    );
  }

  const referralUrl = `https://nyumbasearch.com/register?ref=${data.referralCode}`;
  const shareText = "Join me on NyumbaSearch — find your next home or manage your properties: " + referralUrl;
  const whatsappUrl = "https://wa.me/?text=" + encodeURIComponent(shareText);

  return (
    <>
      <SiteNav />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-1 text-xl font-bold text-white">Invite & earn</h1>
        <p className="mb-6 text-sm text-white/50">
          Share your referral link. When they sign up and take their first real action, you both get rewarded.
        </p>

        {/* Referral link */}
        <div className="mb-6 rounded-2xl bg-[#1c2128] p-5">
          <p className="mb-2 text-[13px] text-white/50">Your referral link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={referralUrl}
              className="flex-1 rounded-lg border border-white/10 bg-[#0d1117] px-3 py-2 text-sm text-white"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(referralUrl);
                toast.success("Copied!");
              }}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-white hover:border-white/20"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-medium text-white hover:bg-[#20bd5a]"
            >
              <ExternalLink className="h-3.5 w-3.5" /> WhatsApp
            </a>
          </div>
          <p className="mt-2 text-[11.5px] text-white/35">
            Code: <span className="font-mono text-white/50">{data.referralCode}</span>
          </p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatCard icon={Clock} label="Pending" value={data.pendingCount} />
          <StatCard icon={CheckCircle} label="Converted" value={data.convertedCount} color="text-emerald-400" />
          <StatCard icon={Gift} label="Total earned" value={data.totalRewardsSummary} />
        </div>

        {/* Referral list */}
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Users className="h-4 w-4" /> Your referrals
        </h2>
        {data.referrals.length === 0 ? (
          <p className="rounded-xl bg-[#1c2128] px-4 py-8 text-center text-sm text-white/40">
            No referrals yet. Share your link to get started.
          </p>
        ) : (
          <div className="space-y-0 divide-y divide-white/6 rounded-xl bg-[#1c2128] px-4">
            {data.referrals.map((r: { id: string; referredName: string; referredRole: string; status: string }) => (
              <div key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <span className="text-[13.5px] text-white">{r.referredName}</span>
                  <span className="ml-2 text-[12px] text-white/40">({r.referredRole})</span>
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: Readonly<{
  icon: typeof Clock;
  label: string;
  value: string | number;
  color?: string;
}>) {
  return (
    <div className="rounded-xl bg-[#1c2128] p-4">
      <div className="mb-1 flex items-center gap-1.5 text-[12px] text-white/40">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className={`text-lg font-bold ${color ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function StatusPill({ status }: Readonly<{ status: string }>) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "Pending" },
    converted: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Converted" },
    expired: { bg: "bg-white/5", text: "text-white/40", label: "Expired" },
    fraud_flagged: { bg: "bg-red-500/10", text: "text-red-400", label: "Flagged" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}
