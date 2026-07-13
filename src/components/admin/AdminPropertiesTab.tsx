import { Link } from "@tanstack/react-router";

import { BadgeCheck, Loader2, Plus, ShieldCheck, ShieldOff } from "lucide-react";

import type { UseMutationResult } from "@tanstack/react-query";

import type { AdminProperty } from "@/components/admin/admin-types";
import { AdminPropertyAuthenticityControls } from "@/components/admin/AdminPropertyAuthenticityControls";
import { ReviewQueueItem } from "@/components/admin/ReviewQueueItem";
import { reviewPrioritySort, resolveReviewPriority } from "@/lib/design/status";

import { isDemoListingId } from "@/data/mockListings";

type ToggleVerification = UseMutationResult<
  { id: string; title: string; is_verified: boolean; nyumba_verified_at: string | null },
  Error,
  { propertyId: string; verified: boolean },
  unknown
>;

type AdjustAuthenticityScore = UseMutationResult<
  { id: string; title: string; authenticity_score: number },
  Error,
  { propertyId: string; delta: number },
  unknown
>;

type Props = Readonly<{
  properties: AdminProperty[];

  loading: boolean;

  toggleVerification: ToggleVerification;

  adjustAuthenticityScore: AdjustAuthenticityScore;
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

function AdminPropertyRow({
  property,

  toggleVerification,

  adjustAuthenticityScore,
}: Readonly<{
  property: AdminProperty;
  toggleVerification: ToggleVerification;
  adjustAuthenticityScore: AdjustAuthenticityScore;
}>) {
  const isDemo = isDemoListingId(property.id);

  const pending =
    toggleVerification.isPending && toggleVerification.variables?.propertyId === property.id;

  return (
    <tr>
      <td className="px-4 py-3 font-medium">
        <Link to="/tenant/property/$id" params={{ id: property.id }} className="hover:underline">
          {property.title}
        </Link>

        {isDemo ? (
          <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Demo
          </span>
        ) : null}
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
          disabled={isDemo}
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
        {isDemo ? (
          <span className="text-xs text-muted-foreground">Live listing only</span>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              toggleVerification.mutate({
                propertyId: property.id,

                verified: !property.is_verified,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
          >
            <VerificationToggleIcon pending={pending} isVerified={property.is_verified} />

            {property.is_verified ? "Unverify" : "Verify"}
          </button>
        )}
      </td>
    </tr>
  );
}

export function AdminPropertiesTab({
  properties,
  loading,
  toggleVerification,
  adjustAuthenticityScore,
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
          Review live listings, verify any property, or publish on behalf of a landlord, agency, or
          manager.
        </p>

        <Link
          to="/admin/listings/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          List on behalf
        </Link>
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
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
