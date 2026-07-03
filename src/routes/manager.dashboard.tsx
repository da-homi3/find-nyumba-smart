import { createFileRoute, Link } from "@tanstack/react-router";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  listManagerProperties,
  listLandlordLeads,
  updatePropertyVacancy,
} from "@/lib/api/nyumba.functions";

import { listPortfolioViewingStatuses } from "@/lib/api/booking.functions";

import { Building2, Download, Inbox } from "lucide-react";
import { BrandLogoLink } from "@/components/BrandLogo";

import { toast } from "sonner";

import { formatKes, type Property } from "@/lib/properties";

import { downloadCsv } from "@/lib/csv-export";

import {
  VACANCY_PIPELINE_STAGES,
  groupPropertiesByPipelineStage,
  classifyVacancyStage,
} from "@/lib/vacancy-pipeline";

import { useMemo } from "react";

export const Route = createFileRoute("/manager/dashboard")({
  head: () => ({ meta: [{ title: "Property manager — NyumbaSearch" }] }),

  component: ManagerDashboard,
});

function ManagerDashboard() {
  const qc = useQueryClient();

  const { data: properties = [] } = useQuery({
    queryKey: ["manager-properties"],

    queryFn: () => listManagerProperties(),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["manager-leads"],

    queryFn: () => listLandlordLeads(),
  });

  const { data: viewingStatuses = [] } = useQuery({
    queryKey: ["portfolio-viewing-statuses"],

    queryFn: () => listPortfolioViewingStatuses(),
  });

  const inquiryCountByProperty = useMemo(() => {
    const map = new Map<string, number>();

    for (const lead of leads) {
      const pid = lead.property_id;

      map.set(pid, (map.get(pid) ?? 0) + 1);
    }

    return map;
  }, [leads]);

  const viewingStatusByProperty = useMemo(() => {
    const map = new Map<string, "pending" | "confirmed" | "cancelled" | "completed">();

    for (const row of viewingStatuses) {
      const status = row.status as "pending" | "confirmed" | "cancelled" | "completed";

      map.set(row.property_id, status);
    }

    return map;
  }, [viewingStatuses]);

  const pipeline = useMemo(
    () =>
      groupPropertiesByPipelineStage(properties, inquiryCountByProperty, viewingStatusByProperty),

    [properties, inquiryCountByProperty, viewingStatusByProperty],
  );

  const vacant = properties.filter((p) => p.is_vacant !== false).length;

  const occupied = properties.length - vacant;

  const vacancyMutation = useMutation({
    mutationFn: (args: { propertyId: string; isVacant: boolean }) =>
      updatePropertyVacancy({ data: args }),

    onSuccess: (_, vars) => {
      toast.success(vars.isVacant ? "Marked as vacant" : "Marked as filled");

      qc.invalidateQueries({ queryKey: ["manager-properties"] });
    },

    onError: (e: Error) => toast.error(e.message),
  });

  const exportVacancyReport = () => {
    if (properties.length === 0) {
      toast.error("No properties to export");

      return;
    }

    const headers = [
      "Property",

      "Neighborhood",

      "Rent (KES)",

      "Vacant",

      "Active",

      "Pipeline stage",

      "Inquiries",
    ];

    const rows = properties.map((p) => {
      const stage = classifyVacancyStage(p, {
        inquiryCount: inquiryCountByProperty.get(p.id) ?? 0,

        viewingStatus: viewingStatusByProperty.get(p.id) ?? null,
      });

      return [
        p.title,

        p.neighborhood,

        String(p.rent_kes),

        p.is_vacant !== false ? "Yes" : "No",

        p.is_active ? "Yes" : "No",

        stage,

        String(inquiryCountByProperty.get(p.id) ?? 0),
      ];
    });

    downloadCsv(`vacancy-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);

    toast.success("Vacancy report downloaded");
  };

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b bg-foreground px-5 py-4 text-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="shrink-0 rounded-xl bg-white px-3 py-2 shadow-sm">
              <BrandLogoLink to="/" logoClassName="h-7" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-background/60">
                Property manager
              </p>

              <h1 className="font-display text-lg font-semibold">Portfolio overview</h1>
            </div>
          </div>

          <Link to="/settings" className="text-sm text-gold">
            Settings →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Properties managed" value={String(properties.length)} />

          <StatCard label="Vacant units" value={String(vacant)} />

          <StatCard
            label="Occupancy rate"
            value={`${properties.length ? Math.round((occupied / properties.length) * 100) : 0}%`}
          />
        </div>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Your portfolio</h2>

            <Link to="/manager/properties" className="text-sm font-semibold text-primary">
              View all →
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              to="/manager/properties/new"
              className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card p-4 text-sm font-semibold text-primary"
            >
              + Add listing
            </Link>

            {properties.slice(0, 8).map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                onToggleVacancy={(isVacant) =>
                  vacancyMutation.mutate({ propertyId: p.id, isVacant })
                }
                busy={vacancyMutation.isPending}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Vacancy pipeline</h2>

            <button
              type="button"
              onClick={exportVacancyReport}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-5">
            {VACANCY_PIPELINE_STAGES.map((col) => (
              <div key={col} className="rounded-2xl border bg-card p-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">{col}</p>

                <p className="text-[10px] text-muted-foreground">{pipeline[col].length} units</p>

                <div className="mt-2 space-y-2">
                  {pipeline[col].slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg bg-secondary px-2 py-1.5 text-xs font-medium"
                    >
                      {p.title}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Inbox className="h-5 w-5" /> Leads ({leads.length})
          </h2>

          <Link
            to="/manager/leads"
            search={{ thread: undefined }}
            className="mt-3 inline-block text-sm font-semibold text-primary"
          >
            Open leads inbox →
          </Link>
        </section>
      </main>
    </div>
  );
}

function PropertyCard({
  property,

  onToggleVacancy,

  busy,
}: Readonly<{
  property: Property;

  onToggleVacancy: (isVacant: boolean) => void;

  busy: boolean;
}>) {
  const isVacant = property.is_vacant !== false;

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />

        <p className="font-semibold text-sm">{property.title}</p>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">{property.neighborhood}</p>

      <p className="mt-2 text-sm font-semibold">{formatKes(property.rent_kes)}</p>

      <button
        type="button"
        disabled={busy}
        onClick={() => onToggleVacancy(!isVacant)}
        className="mt-3 text-[10px] font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
      >
        Mark as {isVacant ? "filled" : "vacant"}
      </button>
    </div>
  );
}

function StatCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-2xl font-semibold">{value}</p>

      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
