import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { listPmProperties } from "@/lib/api/pm.functions";
import { type PmPortal } from "@/components/pm/pm-nav";

const NEW_PATH = {
  landlord: "/landlord/manage/new",
  agency: "/agency/manage/new",
  manager: "/manager/manage/new",
} as const;

const DETAIL_PATH = {
  landlord: "/landlord/manage/$propertyId",
  agency: "/agency/manage/$propertyId",
  manager: "/manager/manage/$propertyId",
} as const;

export function PmPropertyListPage({ portal }: Readonly<{ portal: PmPortal }>) {
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["pm-properties", portal],
    queryFn: () => listPmProperties(),
  });

  let body: ReactNode;
  if (isLoading) {
    body = (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  } else if (properties.length === 0) {
    body = (
      <div className="rounded-2xl border border-dashed border-border bg-background/60 px-6 py-16 text-center">
        <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">No managed properties yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Create a property to add buildings, units, and tenants — entirely separate from public
          listings.
        </p>
        <Link
          to={NEW_PATH[portal]}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
        >
          <Plus className="h-4 w-4" /> Create first property
        </Link>
      </div>
    );
  } else {
    body = (
      <ul className="space-y-3">
        {properties.map(
          (p: {
            id: string;
            name: string;
            neighborhood: string;
            property_type: string;
            status: string;
          }) => (
            <li key={p.id}>
              <Link
                to={DETAIL_PATH[portal]}
                params={{ propertyId: p.id }}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-4 transition hover:border-foreground/20"
              >
                <div>
                  <div className="font-semibold text-foreground">{p.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.neighborhood} · {p.property_type.replaceAll("_", " ")}
                  </div>
                </div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {p.status}
                </span>
              </Link>
            </li>
          ),
        )}
      </ul>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Manage portfolio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track units, tenants, and rent — no marketplace listing required.
          </p>
        </div>
        <Link
          to={NEW_PATH[portal]}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-4 py-2.5 text-sm font-semibold text-gold-foreground"
        >
          <Plus className="h-4 w-4" /> Add property
        </Link>
      </div>
      {body}
    </div>
  );
}
