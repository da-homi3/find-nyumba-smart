import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  listAdminVerifications,
  updateVerificationStatus,
  listAdminVerificationRequests,
  updateVerificationRequest,
  listAdminScamReports,
  updateScamReportStatus,
  listAdminAuditLogs,
  listAdminProperties,
  setAdminPropertyVerification,
  adjustAdminPropertyAuthenticityScore,
} from "@/lib/api/admin.functions";
import { listPendingApplications, reviewPortalApplication } from "@/lib/api/portal.functions";
import {
  listPendingServiceProviders,
  reviewServiceProvider,
} from "@/lib/api/service-provider.functions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { AdminTab } from "@/components/admin/admin-shared";
import { AdminApplicationsTab } from "@/components/admin/AdminApplicationsTab";
import { AdminServiceProvidersTab } from "@/components/admin/AdminServiceProvidersTab";
import { AdminAuditsTab } from "@/components/admin/AdminAuditsTab";
import { AdminPropertiesTab } from "@/components/admin/AdminPropertiesTab";
import { AdminScamsTab } from "@/components/admin/AdminScamsTab";
import { AdminVerificationsTab } from "@/components/admin/AdminVerificationsTab";
import { AdminPropertyChecksTab } from "@/components/admin/AdminPropertyChecksTab";
import { AdminAnnouncementsTab } from "@/components/admin/AdminAnnouncementsTab";
import { AdminAdvertiseTab } from "@/components/admin/AdminAdvertiseTab";
import { AdminFoundingPromoTab } from "@/components/admin/AdminFoundingPromoTab";
import { AdminListingAccountsTab } from "@/components/admin/AdminListingAccountsTab";
import { BrandLogo } from "@/components/BrandLogo";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { DashboardSettingsLink } from "@/components/dashboard/DashboardSettingsLink";
import { buildPageHead } from "@/lib/seo/head";
import { OnboardingTourHost } from "@/components/onboarding/OnboardingTourHost";

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: () =>
    buildPageHead({
      title: "Admin — NyumbaSearch",
      description: "NyumbaSearch platform administration.",
      path: "/admin",
      noIndex: true,
    }),
  component: () => (
    <RouteErrorBoundary title="Admin dashboard failed to load">
      <AdminDashboard />
    </RouteErrorBoundary>
  ),
});

function AdminDashboard() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { tab: tabFromUrl } = Route.useSearch();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (tabFromUrl === "applications") return "applications";
    if (tabFromUrl === "providers") return "providers";
    if (tabFromUrl === "property_checks") return "property_checks";
    if (tabFromUrl === "properties") return "properties";
    return "verifications";
  });
  const qc = useQueryClient();

  useEffect(() => {
    if (tabFromUrl === "applications") setActiveTab("applications");
    if (tabFromUrl === "providers") setActiveTab("providers");
    if (tabFromUrl === "property_checks") setActiveTab("property_checks");
    if (tabFromUrl === "properties") setActiveTab("properties");
  }, [tabFromUrl]);

  const { data: verifications = [], isLoading: verLoading } = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: () => listAdminVerifications(),
    enabled: isAdmin && !authLoading,
  });

  const { data: propertyChecks = [], isLoading: checksLoading } = useQuery({
    queryKey: ["admin-property-checks"],
    queryFn: () => listAdminVerificationRequests(),
    enabled: isAdmin && !authLoading && activeTab === "property_checks",
  });

  const { data: scams = [], isLoading: scamsLoading } = useQuery({
    queryKey: ["admin-scams"],
    queryFn: () => listAdminScamReports(),
    enabled: isAdmin && !authLoading,
  });

  const { data: properties = [], isLoading: propLoading } = useQuery({
    queryKey: ["admin-properties"],
    queryFn: () => listAdminProperties(),
    enabled: isAdmin && !authLoading,
  });

  const { data: audits = [], isLoading: auditsLoading } = useQuery({
    queryKey: ["admin-audits"],
    queryFn: () => listAdminAuditLogs(),
    enabled: isAdmin && !authLoading,
  });

  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () => listPendingApplications(),
    enabled: isAdmin && !authLoading && activeTab === "applications",
  });

  const { data: pendingProviders = [], isLoading: providersLoading } = useQuery({
    queryKey: ["admin-service-providers"],
    queryFn: () => listPendingServiceProviders(),
    enabled: isAdmin && !authLoading,
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

  const reviewProvider = useMutation({
    mutationFn: (payload: {
      providerId: string;
      action: "approve" | "reject";
      rejectionReason?: string;
    }) => reviewServiceProvider({ data: payload }),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.action === "approve"
          ? "Service provider approved — listing is live"
          : "Service provider rejected",
      );
      qc.invalidateQueries({ queryKey: ["admin-service-providers"] });
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

  const togglePropertyVerification = useMutation({
    mutationFn: (payload: { propertyId: string; verified: boolean }) =>
      setAdminPropertyVerification({ data: payload }),
    onSuccess: (_row, vars) => {
      toast.success(vars.verified ? "Property verified" : "Verification removed");
      qc.invalidateQueries({ queryKey: ["admin-properties"] });
      qc.invalidateQueries({ queryKey: ["admin-audits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustAuthenticityScore = useMutation({
    mutationFn: (payload: { propertyId: string; delta?: number; score?: number }) =>
      adjustAdminPropertyAuthenticityScore({ data: payload }),
    onSuccess: (row) => {
      toast.success(`Authenticity score set to ${row.authenticity_score}%`);
      qc.invalidateQueries({ queryKey: ["admin-properties"] });
      qc.invalidateQueries({ queryKey: ["admin-audits"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
    {
      id: "providers" as const,
      label: "Service providers",
      count: pendingProviders.length,
    },
    { id: "advertise" as const, label: "Advertise", count: 0 },
    { id: "announcements" as const, label: "Announcements", count: 0 },
    { id: "listing_accounts" as const, label: "Listing limits", count: 0 },
    { id: "founding_promo" as const, label: "Founding promo", count: 0 },
  ];

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-xl font-semibold">Administrator access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with an admin account to manage verifications and listings.
        </p>
        <Link to="/tenant" className="mt-6 inline-block text-sm font-semibold text-primary">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              to="/tenant"
              aria-label="Back to tenant home"
              className="shrink-0 rounded-full p-1.5 hover:bg-secondary"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <div className="shrink-0 rounded-lg bg-white px-2 py-1 shadow-sm">
              <BrandLogo logoClassName="h-6" />
            </div>
            <h1 className="truncate font-display text-lg font-bold sm:text-xl">
              Admin Control Center
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <DashboardSettingsLink variant="pill" />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Logged in as Administrator
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-tour="admin-tabs">
          <div className="flex min-w-max border-b text-xs font-semibold">
            {tabs.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`shrink-0 whitespace-nowrap pb-3 px-3 sm:px-4 -mb-px border-b-2 transition ${
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
        </div>

        <div className="mt-6" data-tour="admin-content">
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
            <AdminPropertiesTab
              properties={properties}
              loading={propLoading}
              toggleVerification={togglePropertyVerification}
              adjustAuthenticityScore={adjustAuthenticityScore}
            />
          )}
          {activeTab === "audits" && <AdminAuditsTab audits={audits} loading={auditsLoading} />}
          {activeTab === "applications" && (
            <AdminApplicationsTab
              applications={applications}
              loading={appsLoading}
              review={reviewApp}
            />
          )}
          {activeTab === "providers" && (
            <AdminServiceProvidersTab
              providers={pendingProviders}
              loading={providersLoading}
              review={reviewProvider}
            />
          )}
          {activeTab === "advertise" && <AdminAdvertiseTab />}
          {activeTab === "announcements" && <AdminAnnouncementsTab />}
          {activeTab === "founding_promo" && <AdminFoundingPromoTab />}
          {activeTab === "listing_accounts" && <AdminListingAccountsTab />}
        </div>
      </div>
      <OnboardingTourHost tourId="admin-dashboard" />
    </div>
  );
}
