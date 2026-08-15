import type { ReactNode } from "react";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";

export { VERIFICATION_STATUS_CLASS, SCAM_STATUS_CLASS } from "@/components/admin/admin-types";
export type {
  AdminTab,
  AdminVerification,
  AdminPropertyCheck,
  AdminScamReport,
  AdminProperty,
  AdminAuditLog,
  PendingApplication,
  PendingServiceProvider,
} from "@/components/admin/admin-types";

export function StatusBadge({
  status,
  classMap,
  fallbackClass,
}: Readonly<{
  status: string;
  classMap: Record<string, string>;
  fallbackClass: string;
}>) {
  const tone = classMap[status] ?? fallbackClass;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>{status}</span>;
}

export function AdminAsyncPanel({
  loading,
  loadingMessage,
  emptyContent,
  isEmpty,
  children,
  skeletonCols = 4,
  skeletonRows = 5,
}: Readonly<{
  loading: boolean;
  loadingMessage: string;
  emptyContent: ReactNode;
  isEmpty: boolean;
  children: ReactNode;
  skeletonCols?: number;
  skeletonRows?: number;
}>) {
  if (loading) {
    return (
      <div>
        <p className="mb-4 text-sm text-muted-foreground">{loadingMessage}</p>
        <TableSkeleton cols={skeletonCols} rows={skeletonRows} />
      </div>
    );
  }
  if (isEmpty) return emptyContent;
  return children;
}

export function AdminField({
  label,
  children,
  className = "text-xs",
}: Readonly<{ label: string; children: ReactNode; className?: string }>) {
  return (
    <label className={className}>
      <span className="block">{label}</span>
      {children}
    </label>
  );
}
