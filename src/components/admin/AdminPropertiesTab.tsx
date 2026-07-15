import { Link } from "@tanstack/react-router";
import { BadgeCheck, Download, Loader2, Pencil, Plus, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { AdminProperty } from "@/components/admin/admin-types";
import { AdminPropertyAuthenticityControls } from "@/components/admin/AdminPropertyAuthenticityControls";
import { ReviewQueueItem } from "@/components/admin/ReviewQueueItem";
import { reviewPrioritySort, resolveReviewPriority } from "@/lib/design/status";
import { getAdminPropertyMediaDownloads } from "@/lib/api/admin.functions";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";
import { useState } from "react";

type ToggleVerification = UseMutationResult<
  { id: string; title: string; is_verified: boolean; nyumba_verified_at: string | null },
  Error,
  { propertyId: string; verified: boolean },
  unknown
>;

type AdjustAuthenticityScore = UseMutationResult<
  { id: string; title: string; authenticity_score: number },
  Error,
  { propertyId: string; delta?: number; score?: number },
  unknown
>;

type SetActive = UseMutationResult<
  { id: string; title: string; is_active: boolean },
  Error,
  { propertyId: string; isActive: boolean },
  unknown
>;

type Props = Readonly<{
  properties: AdminProperty[];
  loading: boolean;
  toggleVerification: ToggleVerification;
  adjustAuthenticityScore: AdjustAuthenticityScore;
  setPropertyActive: SetActive;
}>;

function verificationBadgeClass(isVerified: boolean) {
  return isVerified ? "bg-emerald-500/10 text-emerald-600" : "bg-gray-500/10 text-gray-600";
}

function statusBadgeClass(isActive: boolean) {
  return isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground";
}

function VerificationToggleIcon({
  pending,
  isVerified,
}: Readonly<{ pending: boolean; isVerified: boolean }>) {
  if (pending) return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  if (isVerified) return <ShieldOff className="h-3.5 w-3.5" />;
  return <ShieldCheck className="h-3.5 w-3.5" />;
}

async function downloadMediaBlob(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download ${filename}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function AdminPropertyRow({
  property,
  toggleVerification,
  adjustAuthenticityScore,
  setPropertyActive,
}: Readonly<{
  property: AdminProperty;
  toggleVerification: ToggleVerification;
  adjustAuthenticityScore: AdjustAuthenticityScore;
  setPropertyActive: SetActive;
}>) {
  const [downloading, setDownloading] = useState(false);
  const pendingVerify =
    toggleVerification.isPending && toggleVerification.variables?.propertyId === property.id;
  const pendingActive =
    setPropertyActive.isPending && setPropertyActive.variables?.propertyId === property.id;

  async function downloadMedia() {
    setDownloading(true);
    try {
      const pack = await getAdminPropertyMediaDownloads({ data: { propertyId: property.id } });
      if (pack.items.length === 0) {
        toast.info("No photos or videos on this listing");
        return;
      }
      toast.message(`Downloading ${pack.items.length} file(s)…`);
      for (const item of pack.items) {
        await downloadMediaBlob(item.url, item.filename);
      }
      toast.success("Media download started");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <tr>
      <td className="px-4 py-3 font-medium">
        <Link to="/tenant/property/$id" params={{ id: property.id }} className="hover:underline">
          {property.title}
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{property.neighborhood}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span
            className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs ${verificationBadgeClass(property.is_verified)}`}
          >
            {property.is_verified ? <BadgeCheck className="h-3 w-3" aria-hidden /> : null}
            {property.is_verified ? "Verified" : "Unverified"}
          </span>
          {property.nyumba_verified_at ? (
            <span className="text-[10px] text-muted-foreground">NyumbaSearch verified</span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3">
        <AdminPropertyAuthenticityControls
          propertyId={property.id}
          score={property.authenticity_score ?? 70}
          adjustScore={adjustAuthenticityScore}
        />
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(property.is_active)}`}
        >
          {property.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pendingVerify}
            onClick={() =>
              toggleVerification.mutate({
                propertyId: property.id,
                verified: !property.is_verified,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
          >
            <VerificationToggleIcon pending={pendingVerify} isVerified={property.is_verified} />
            {property.is_verified ? "Unverify" : "Verify"}
          </button>
          <Link
            to="/admin/listings/$id/edit"
            params={{ id: property.id }}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
          <button
            type="button"
            disabled={downloading}
            onClick={() => void downloadMedia()}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Media
          </button>
          <button
            type="button"
            disabled={pendingActive}
            onClick={() => {
              const nextActive = !property.is_active;
              if (
                !nextActive &&
                !globalThis.confirm(`Remove “${property.title}” from the market?`)
              ) {
                return;
              }
              setPropertyActive.mutate({ propertyId: property.id, isActive: nextActive });
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
          >
            {pendingActive ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {property.is_active ? "Delete" : "Restore"}
          </button>
        </div>
      </td>
    </tr>
  );
}

export function AdminPropertiesTab({
  properties,
  loading,
  toggleVerification,
  adjustAuthenticityScore,
  setPropertyActive,
}: Props) {
  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading listings...</div>;
  }

  const sorted = reviewPrioritySort(properties);
  const flagged = sorted.filter((p) => resolveReviewPriority(p) === "flagged");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Full admin access: edit, delete, download media, or publish independently / on behalf.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/listings/new"
            search={{ mode: "self" }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Upload independently
          </Link>
          <Link
            to="/admin/listings/new"
            search={{ mode: "behalf" }}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            List on behalf
          </Link>
        </div>
      </div>

      {flagged.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-destructive">Priority review queue</h3>
          {flagged.map((property) => (
            <ReviewQueueItem
              key={property.id}
              listing={property}
              actions={
                <button
                  type="button"
                  onClick={() =>
                    toggleVerification.mutate({
                      propertyId: property.id,
                      verified: !property.is_verified,
                    })
                  }
                  className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  {property.is_verified ? "Unverify" : "Verify"}
                </button>
              }
            />
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Property</th>
              <th className="px-4 py-3 text-left">Location</th>
              <th className="px-4 py-3 text-left">Verification</th>
              <th className="px-4 py-3 text-left">Auth Score</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((property) => (
              <AdminPropertyRow
                key={property.id}
                property={property}
                toggleVerification={toggleVerification}
                adjustAuthenticityScore={adjustAuthenticityScore}
                setPropertyActive={setPropertyActive}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
