import { createFileRoute, useParams } from "@tanstack/react-router";
import { z } from "zod";
import { fetchProperty } from "@/lib/properties";
import { verificationLevel } from "@/lib/listing-intel";
import { BookingModal } from "@/components/BookingModal";
import { PropertyDetailActionBar } from "@/components/property-detail/PropertyDetailActionBar";
import { PropertyDetailContent } from "@/components/property-detail/PropertyDetailContent";
import { PropertyDetailGallery } from "@/components/property-detail/PropertyDetailGallery";
import { PropertyDetailMedia } from "@/components/property-detail/PropertyDetailMedia";
import { buildPropertyDetailHead } from "@/components/property-detail/property-detail-head";
import { usePropertyDetail } from "@/hooks/use-property-detail";
import { PropertyDetailSkeleton } from "@/components/skeletons/PropertyDetailSkeleton";
import { useEntitlements } from "@/hooks/use-entitlements";
import { ListingsPreviewOverlay } from "@/components/ListingsPreviewOverlay";
import { isPreviewListing } from "@/lib/listings-preview";

const propertySearchSchema = z.object({
  from: z.enum(["map"]).optional(),
});

export const Route = createFileRoute("/tenant/property/$id")({
  validateSearch: propertySearchSchema,
  loader: async ({ params, context }) => {
    const property = await fetchProperty(params.id);
    if (property) {
      context.queryClient.setQueryData(["property", params.id], property);
    }
    return { property };
  },
  head: ({ loaderData }) => buildPropertyDetailHead(loaderData?.property ?? undefined),
  component: PropertyDetail,
});

function PropertyDetail() {
  const { id } = useParams({ from: "/tenant/property/$id" });
  const { property: loaderProperty } = Route.useLoaderData();
  const { isPlus } = useEntitlements();
  const detail = usePropertyDetail(id, loaderProperty);

  if (detail.isLoading && !detail.p) {
    return <PropertyDetailSkeleton />;
  }
  if (!detail.p) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {detail.isError ? "Could not load this listing." : "Property not found."}
        </p>
        {detail.isError && (
          <button
            type="button"
            onClick={() => detail.refetch()}
            className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const p = detail.p;
  const gallery = p.images.length > 0 ? p.images : [];
  const score = p.authenticity_score ?? 70;
  const vLevel = verificationLevel(p);
  const previewActive =
    isPreviewListing(p) || (loaderProperty != null && isPreviewListing(loaderProperty));

  return (
    <ListingsPreviewOverlay active={previewActive} className="min-h-screen">
      <div className="pb-32 bg-background min-h-screen">
        {detail.isDemo && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-center text-xs text-amber-900 dark:text-amber-200">
            Demo listing — browse photos and AI tools here. Save, message, and book viewings on live
            listings from verified landlords.
          </div>
        )}

        <PropertyDetailGallery
          property={p}
          gallery={gallery}
          galleryIndex={detail.galleryIndex}
          onGalleryIndexChange={detail.setGalleryIndex}
          verificationLevel={vLevel}
          authenticityScore={score}
          isSaved={detail.isSaved}
          onToggleSave={() => detail.toggleSave.mutate()}
        />

        <PropertyDetailMedia property={p} />

        <PropertyDetailContent
          property={p}
          propertyId={id}
          userId={detail.user?.id}
          isPlus={isPlus}
          landlordName={detail.landlordContact?.fullName ?? "Verified landlord"}
          similar={detail.similar}
          valuation={detail.valuation}
          valLoading={detail.valLoading}
          chatMessages={detail.chatMessages}
          chatInput={detail.chatInput}
          chatLoading={detail.chatLoading}
          onChatInputChange={detail.setChatInput}
          onChatSubmit={detail.handleSendChat}
          isDemo={detail.isDemo}
          reportOpen={detail.reportOpen}
          reportReason={detail.reportReason}
          reportDetails={detail.reportDetails}
          reportSubmitting={detail.reportSubmitting}
          onReportOpen={detail.openReportForm}
          onReportClose={() => detail.setReportOpen(false)}
          onReportReasonChange={detail.setReportReason}
          onReportDetailsChange={detail.setReportDetails}
          onReportSubmit={() => void detail.submitReport()}
          onContactUnlocked={(phone) => detail.setUnlockedPhone(phone)}
        />

        <PropertyDetailActionBar
          onCall={detail.handleCall}
          onMessage={() => detail.messageLandlord.mutate()}
          messagePending={detail.messageLandlord.isPending}
          messageLabel={
            detail.landlordContact?.preferWhatsApp || detail.p?.whatsapp_inquiries
              ? "WhatsApp"
              : "Message"
          }
          onBook={detail.openBooking}
        />

        <BookingModal
          propertyId={p.id}
          propertyTitle={p.title}
          propertyAddress={p.address ?? p.neighborhood}
          isOpen={detail.isBookingOpen}
          onClose={() => detail.setIsBookingOpen(false)}
          onUnauthorized={detail.redirectToAuth}
        />
      </div>
    </ListingsPreviewOverlay>
  );
}
