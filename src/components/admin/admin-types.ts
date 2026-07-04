import {
  listAdminVerifications,
  listAdminVerificationRequests,
  listAdminScamReports,
  listAdminAuditLogs,
} from "@/lib/api/admin.functions";
import { listPendingApplications } from "@/lib/api/portal.functions";
import { listPendingServiceProviders } from "@/lib/api/service-provider.functions";
import { listProperties } from "@/lib/api/nyumba.functions";

export type AdminTab =
  | "verifications"
  | "property_checks"
  | "scams"
  | "properties"
  | "audits"
  | "applications"
  | "providers"
  | "advertise"
  | "announcements";

export type AdminVerification = Awaited<ReturnType<typeof listAdminVerifications>>[number];
export type AdminPropertyCheck = Awaited<ReturnType<typeof listAdminVerificationRequests>>[number];
export type AdminScamReport = Awaited<ReturnType<typeof listAdminScamReports>>[number];
export type AdminProperty = NonNullable<
  Awaited<ReturnType<typeof listProperties>>["items"]
>[number];
export type AdminAuditLog = Awaited<ReturnType<typeof listAdminAuditLogs>>[number];
export type PendingApplication = Awaited<ReturnType<typeof listPendingApplications>>[number];
export type PendingServiceProvider = Awaited<
  ReturnType<typeof listPendingServiceProviders>
>[number];

export const VERIFICATION_STATUS_CLASS: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-red-500/10 text-red-600",
  pending: "bg-amber-500/10 text-amber-600",
};

export const SCAM_STATUS_CLASS: Record<string, string> = {
  reviewed: "bg-emerald-500/10 text-emerald-600",
  pending: "bg-amber-500/10 text-amber-600",
};
