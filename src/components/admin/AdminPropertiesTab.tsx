import { Link } from "@tanstack/react-router";
import type { AdminProperty } from "@/components/admin/admin-shared";

type Props = Readonly<{
  properties: AdminProperty[];
  loading: boolean;
}>;

export function AdminPropertiesTab({ properties, loading }: Props) {
  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading listings...</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Property</th>
            <th className="px-4 py-3 text-left">Location</th>
            <th className="px-4 py-3 text-left">Verification Status</th>
            <th className="px-4 py-3 text-left">Auth Score</th>
            <th className="px-4 py-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {properties.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 font-medium">
                <Link to="/tenant/property/$id" params={{ id: p.id }} className="hover:underline">
                  {p.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{p.neighborhood}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                    p.is_verified
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-gray-500/10 text-gray-600"
                  }`}
                >
                  {p.is_verified ? "Verified" : "Unverified"}
                </span>
              </td>
              <td className="px-4 py-3 font-semibold">{p.authenticity_score ?? 70}%</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    p.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {p.is_active ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
