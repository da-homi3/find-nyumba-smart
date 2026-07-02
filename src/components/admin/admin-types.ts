import {
  listAdminVerifications,
  listAdminScamReports,
  listAdminAuditLogs,
} from "@/lib/api/admin.functions";
import { listPendingApplications } from "@/lib/api/portal.functions";
import { listProperties } from "@/lib/api/nyumba.functions";

export type AdminTab =
  | "verifications"
  | "scams"
  | "properties"
  | "audits"
  | "applications"
  | "announcements";

export type AdminVerification = Awaited<ReturnType<typeof listAdminVerifications>>[number];
export type AdminScamReport = Awaited<ReturnType<typeof listAdminScamReports>>[number];
export type AdminProperty = NonNullable<
  Awaited<ReturnType<typeof listProperties>>["items"]
>[number];
export type AdminAuditLog = Awaited<ReturnType<typeof listAdminAuditLogs>>[number];
export type PendingApplication = Awaited<ReturnType<typeof listPendingApplications>>[number];

export const VERIFICATION_STATUS_CLASS: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-red-500/10 text-red-600",
  pending: "bg-amber-500/10 text-amber-600",
};

export const SCAM_STATUS_CLASS: Record<string, string> = {
  reviewed: "bg-emerald-500/10 text-emerald-600",
  pending: "bg-amber-500/10 text-amber-600",
};
