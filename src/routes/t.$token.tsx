import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicTenantCard } from "@/lib/api/tenant-profile.functions";
import { SiteNav } from "@/components/SiteNav";
import { formatKes } from "@/lib/properties";

export const Route = createFileRoute("/t/$token")({
  component: PublicTenantCardPage,
});

function PublicTenantCardPage() {
  const { token } = Route.useParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-tenant-card", token],
    queryFn: () => getPublicTenantCard({ data: { token } }),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteNav variant="light" />
      <main className="mx-auto max-w-md px-5 py-12">
        <PublicTenantCardBody
          data={data}
          isLoading={isLoading}
          isError={isError}
          error={error}
        />
      </main>
    </div>
  );
}

function PublicTenantCardBody({
  data,
  isLoading,
  isError,
  error,
}: Readonly<{
  data: Awaited<ReturnType<typeof getPublicTenantCard>> | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}>) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading tenant profile…</p>;
  }
  if (isError) {
    return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  }
  if (!data) return null;

  const budgetLow = data.budgetMin ? formatKes(data.budgetMin) : "—";
  const budgetHigh = data.budgetMax ? formatKes(data.budgetMax) : "—";

  return (
    <article className="rounded-2xl border bg-card p-6">
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">NyumbaSearch</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">{data.fullName}</h1>
      <p className="mt-2 font-display text-4xl font-semibold text-primary">{data.scorePercent}%</p>
      <p className="text-sm text-muted-foreground">Tenant Profile completeness</p>
      <ul className="mt-4 space-y-1 text-sm">
        {data.verified.map((item) => (
          <li key={item}>✓ {item}</li>
        ))}
      </ul>
      {data.lookingFor ? <p className="mt-4 text-sm">Looking for: {data.lookingFor}</p> : null}
      {data.locations ? <p className="text-sm">Preferred: {data.locations}</p> : null}
      {data.budgetMin || data.budgetMax ? (
        <p className="text-sm">
          Budget: {budgetLow} – {budgetHigh}
        </p>
      ) : null}
      {data.moveInDate ? <p className="text-sm">Move-in: {data.moveInDate}</p> : null}
      <p className="mt-6 text-xs text-muted-foreground">{data.disclaimer}</p>
    </article>
  );
}
