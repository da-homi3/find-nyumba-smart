import { Link } from "@tanstack/react-router";
import { Building2, Check } from "lucide-react";

export function PmModuleUpsellCard({
  priceLabel,
  subscribePath,
  onActivate,
  loading,
}: Readonly<{
  priceLabel: string;
  subscribePath?: string;
  onActivate?: () => void;
  loading?: boolean;
}>) {
  const bullets = [
    "Rent tracking & M-Pesa collection",
    "Tenant records & portal invitations",
    "Maintenance request routing",
  ];

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-background px-6 py-10 text-center">
      <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
      <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">
        Manage your properties, not just list them
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Track rent, tenants, leases and maintenance in one place. Included free with a paid
        marketplace plan — a 1% fee still applies on rent collected.
      </p>
      <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm font-medium text-foreground">{priceLabel}</p>
      {subscribePath ? (
        <Link
          to={subscribePath}
          className="mt-4 inline-flex rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
        >
          Add Property Management
        </Link>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={onActivate}
          className="mt-4 inline-flex rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
        >
          {loading ? "Starting…" : "Add Property Management"}
        </button>
      )}
    </div>
  );
}
