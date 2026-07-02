import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PublicPageShell } from "@/components/SiteNav";
import { LazyRadar } from "@/components/LazyRadar";
import { getVerificationRequest } from "@/lib/api/verification.functions";
import { VERIFICATION_TIERS } from "@/lib/revenue/plans";
import type { VerificationTier } from "@/lib/revenue/types";

export const Route = createFileRoute("/verify/status/$requestId")({
  component: VerifyStatusPage,
});

function turnaroundFor(tier: string): string {
  const def = VERIFICATION_TIERS.find((t) => t.id === tier);
  return def?.turnaround ?? "48 hours";
}

function isInProgress(status: string): boolean {
  return status === "pending" || status === "in_progress";
}

function verificationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes("Unauthorized")) {
    return "Sign in with the email used when you submitted this verification request.";
  }
  if (error instanceof Error) return error.message;
  return "Could not load this verification request.";
}

function VerificationResultCard({
  request,
}: Readonly<{
  request: {
    status: string;
    property_address: string;
    tier: string;
    report_url: string | null;
  };
}>) {
  const tierLabel = VERIFICATION_TIERS.find((t) => t.id === request.tier)?.name ?? request.tier;
  const completed = request.status === "completed";

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-6">
      <h2 className="font-display text-xl font-semibold">
        {completed ? "Verification complete" : "Verification update"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{request.property_address}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Tier: {tierLabel} · Status: {request.status.replaceAll("_", " ")}
      </p>
      {request.report_url ? (
        <a
          href={request.report_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm font-semibold text-primary"
        >
          Download report →
        </a>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {completed
            ? "Your report is being prepared — we will email you when it is ready."
            : "Our team is reviewing findings. Check back soon or watch for an email update."}
        </p>
      )}
      <Link to="/verify" className="mt-6 inline-block text-sm font-semibold text-primary">
        ← Back to verification
      </Link>
    </div>
  );
}

function VerifyStatusPage() {
  const { requestId } = useParams({ from: "/verify/status/$requestId" });

  const {
    data: request,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["verification-request", requestId],
    queryFn: () => getVerificationRequest({ data: { requestId } }),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isInProgress(status) ? 5000 : false;
    },
  });

  if (isError) {
    const message = verificationErrorMessage(error);
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-2xl px-5 py-12">
          <div className="rounded-2xl border bg-card p-6 text-center">
            <h2 className="font-display text-xl font-semibold">Verification status unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/auth"
                search={{ redirect: `/verify/status/${requestId}`, mode: "signin" }}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Sign in
              </Link>
              <Link to="/verify" className="rounded-xl border px-4 py-2 text-sm font-semibold">
                Back to verification
              </Link>
            </div>
          </div>
        </main>
      </PublicPageShell>
    );
  }

  if (isLoading) {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-4xl px-5 py-8">
          <div className="relative h-[60vh] overflow-hidden rounded-[20px] bg-[#0c1a12]">
            <LazyRadar
              speed={1}
              scale={1}
              ringCount={10}
              spokeCount={10}
              ringThickness={0.05}
              spokeThickness={0.01}
              sweepSpeed={1}
              sweepWidth={2}
              sweepLobes={1}
              color="#1eb88a"
              backgroundColor="#0c1a12"
              falloff={2}
              brightness={1}
              enableMouseInteraction
              mouseInfluence={0.15}
            />
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
              <h2 className="font-display text-xl font-semibold text-white">
                Loading verification status…
              </h2>
            </div>
          </div>
        </main>
      </PublicPageShell>
    );
  }

  if (!request) {
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-2xl px-5 py-12">
          <div className="rounded-2xl border bg-card p-6 text-center">
            <h2 className="font-display text-xl font-semibold">Request not found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This verification link may be invalid or expired.
            </p>
            <Link to="/verify" className="mt-6 inline-block text-sm font-semibold text-primary">
              ← Back to verification
            </Link>
          </div>
        </main>
      </PublicPageShell>
    );
  }

  if (isInProgress(request.status)) {
    const tier = (request?.tier ?? "standard") as VerificationTier;
    return (
      <PublicPageShell>
        <main className="mx-auto max-w-4xl px-5 py-8">
          <div className="relative h-[60vh] overflow-hidden rounded-[20px] bg-[#0c1a12]">
            <LazyRadar
              speed={1}
              scale={1}
              ringCount={10}
              spokeCount={10}
              ringThickness={0.05}
              spokeThickness={0.01}
              sweepSpeed={1}
              sweepWidth={2}
              sweepLobes={1}
              color="#1eb88a"
              backgroundColor="#0c1a12"
              falloff={2}
              brightness={1}
              enableMouseInteraction
              mouseInfluence={0.15}
            />
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
              <h2 className="font-display text-xl font-semibold text-white">
                Our agent is verifying this property
              </h2>
              <p className="mt-2 max-w-sm text-sm text-white/60">
                Expected turnaround: {turnaroundFor(tier)}. We&apos;ll email you the moment
                it&apos;s done.
              </p>
            </div>
          </div>
        </main>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-4xl px-5 py-12">
        <VerificationResultCard request={request} />
      </main>
    </PublicPageShell>
  );
}
