import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  listAdminVerifications,
  updateVerificationStatus,
  listAdminVerificationRequests,
  updateVerificationRequest,
  listAdminScamReports,
  updateScamReportStatus,
  listAdminAuditLogs,
} from "@/lib/api/admin.functions";
import { listPendingApplications, reviewPortalApplication } from "@/lib/api/portal.functions";
import { listProperties } from "@/lib/api/nyumba.functions";
import { toast } from "sonner";
import type { AdminTab } from "@/components/admin/admin-shared";
import { AdminApplicationsTab } from "@/components/admin/AdminApplicationsTab";
import { AdminAuditsTab } from "@/components/admin/AdminAuditsTab";
import { AdminPropertiesTab } from "@/components/admin/AdminPropertiesTab";
import { AdminScamsTab } from "@/components/admin/AdminScamsTab";
import { AdminVerificationsTab } from "@/components/admin/AdminVerificationsTab";
import { AdminPropertyChecksTab } from "@/components/admin/AdminPropertyChecksTab";
import { AdminAnnouncementsTab } from "@/components/admin/AdminAnnouncementsTab";
import { BrandLogo } from "@/components/BrandLogo";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: () => (
    <RouteErrorBoundary title="Admin dashboard failed to load">
      <AdminDashboard />
    </RouteErrorBoundary>
  ),
});

function AdminDashboard() {
  const { tab: tabFromUrl } = Route.useSearch();
  const [activeTab, setActiveTab] = useState<AdminTab>(
    tabFromUrl === "applications" ? "applications" : "verifications",
  );
  const qc = useQueryClient();

  useEffect(() => {
    if (tabFromUrl === "applications") setActiveTab("applications");
    if (tabFromUrl === "property_checks") setActiveTab("property_checks");
  }, [tabFromUrl]);

  const { data: verifications = [], isLoading: verLoading } = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: () => listAdminVerifications(),
  });

  const { data: propertyChecks = [], isLoading: checksLoading } = useQuery({
    queryKey: ["admin-property-checks"],
    queryFn: () => listAdminVerificationRequests(),
    enabled: activeTab === "property_checks",
  });

  const { data: scams = [], isLoading: scamsLoading } = useQuery({
    queryKey: ["admin-scams"],
    queryFn: () => listAdminScamReports(),
  });

  const { data: propertiesResult, isLoading: propLoading } = useQuery({
    queryKey: ["admin-properties"],
    queryFn: () => listProperties({ data: {} }),
  });
  const properties = propertiesResult?.items ?? [];

  const { data: audits = [], isLoading: auditsLoading } = useQuery({
    queryKey: ["admin-audits"],
    queryFn: () => listAdminAuditLogs(),
  });

  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () => listPendingApplications(),
    enabled: activeTab === "applications",
  });

  const reviewApp = useMutation({
    mutationFn: (payload: {
      applicationId: string;
      action: "approve" | "reject";
      rejectionReason?: string;
    }) => reviewPortalApplication({ data: payload }),
    onSuccess: () => {
      toast.success("Application updated");
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveVerification = useMutation({
    mutationFn: async (id: string) => {
      await updateVerificationStatus({ data: { id, status: "approved" } });
    },
    onSuccess: () => {
      toast.success("Verification approved");
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
    },
  });

  const rejectVerification = useMutation({
    mutationFn: async (id: string) => {
      await updateVerificationStatus({ data: { id, status: "rejected" } });
    },
    onSuccess: () => {
      toast.success("Verification rejected");
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
    },
  });

  const updatePropertyCheck = useMutation({
    mutationFn: (payload: {
      id: string;
      status?: "pending" | "in_progress" | "completed" | "cancelled";
      report_url?: string | null;
    }) => updateVerificationRequest({ data: payload }),
    onSuccess: () => {
      toast.success("Property verification updated");
      qc.invalidateQueries({ queryKey: ["admin-property-checks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveScam = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "reviewed" | "dismissed" }) => {
      await updateScamReportStatus({ data: { id, status } });
    },
    onSuccess: () => {
      toast.success("Scam report status updated");
      qc.invalidateQueries({ queryKey: ["admin-scams"] });
    },
  });

  const tabs = [
    {
      id: "verifications" as const,
      label: "Verification Queue",
      count: verifications.filter((v) => v.status === "pending").length,
    },
    {
      id: "property_checks" as const,
      label: "Property checks",
      count: propertyChecks.filter((r) => r.status === "pending" || r.status === "in_progress")
        .length,
    },
    {
      id: "scams" as const,
      label: "Scam Reports",
      count: scams.filter((s) => s.status === "pending").length,
    },
    { id: "properties" as const, label: "Moderate listings", count: properties.length },
    { id: "audits" as const, label: "Audit Logs", count: audits.length },
    { id: "applications" as const, label: "Portal applications", count: applications.length },
    { id: "announcements" as const, label: "Announcements", count: 0 },
  ];

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b bg-card py-4 px-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/tenant"
              aria-label="Back to tenant home"
              className="rounded-full p-1.5 hover:bg-secondary"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <div className="rounded-lg bg-white px-2 py-1 shadow-sm">
              <BrandLogo logoClassName="h-6" />
            </div>
            <h1 className="font-display text-xl font-bold">Admin Control Center</h1>
          </div>
          <div className="flex items-center gap-3">
            <DashboardSettingsLink variant="pill" />
            <span className="text-xs text-muted-foreground">Logged in as Administrator</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 mt-6">
        <div className="flex border-b text-xs font-semibold">
          {tabs.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`pb-3 px-4 -mb-px border-b-2 transition ${
                activeTab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}{" "}
              {t.count > 0 && (
                <span className="ml-1 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px]">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === "verifications" && (
            <AdminVerificationsTab
              verifications={verifications}
              loading={verLoading}
              approve={approveVerification}
              reject={rejectVerification}
            />
          )}
          {activeTab === "property_checks" && (
            <AdminPropertyChecksTab
              requests={propertyChecks}
              loading={checksLoading}
              update={updatePropertyCheck}
            />
          )}
          {activeTab === "scams" && (
            <AdminScamsTab scams={scams} loading={scamsLoading} resolve={resolveScam} />
          )}
          {activeTab === "properties" && (
            <AdminPropertiesTab properties={properties} loading={propLoading} />
          )}
          {activeTab === "audits" && <AdminAuditsTab audits={audits} loading={auditsLoading} />}
          {activeTab === "applications" && (
            <AdminApplicationsTab
              applications={applications}
              loading={appsLoading}
              review={reviewApp}
            />
          )}
          {activeTab === "announcements" && <AdminAnnouncementsTab />}
        </div>
      </div>
    </div>
  );
}
