import { Bath, BedDouble, Calendar, MapPin, Sparkles, Square } from "lucide-react";
import { formatKes, prettyType, type Property } from "@/lib/properties";
import { getListingIntel, verificationLevel } from "@/lib/listing-intel";
import { PropertyIntelligencePanel } from "@/components/PropertyIntelligencePanel";
import { PropertyCard } from "@/components/PropertyCard";
import { VerificationBadge } from "@/components/VerificationBadge";
import { PropertyRevenueBlocks } from "@/components/PropertyRevenueBlocks";
import { PropertyReviewsSection } from "@/components/PropertyReviewsSection";
import { ScamRiskScanner } from "@/components/ScamRiskScanner";
import { PropertyStat } from "./PropertyStat";
import { PropertyAiAssistant } from "./PropertyAiAssistant";
import { PropertyReportSection } from "./PropertyReportSection";
import { ContactUnlockCard } from "@/components/ContactUnlockCard";
import { PREVIEW_LISTING_NOTICE } from "@/lib/listing-visibility";
import { cn } from "@/lib/utils";
import type { SubmitEvent } from "react";

type Valuation = {
  estimatedRentRange: string;
  valuationGrade: string;
  details: string;
};

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

type PropertyDetailContentProps = Readonly<{
  property: Property;
  propertyId: string;
  userId: string | undefined;
  isPlus: boolean;
  landlordName: string;
  similar: Property[];
  valuation: Valuation | undefined;
  valLoading: boolean;
  chatMessages: ChatMessage[];
  chatInput: string;
  chatLoading: boolean;
  onChatInputChange: (value: string) => void;
  onChatSubmit: (e: SubmitEvent<HTMLFormElement>) => void;
  isDemo: boolean;
  reportOpen: boolean;
  reportReason: string;
  reportDetails: string;
  reportSubmitting: boolean;
  onReportOpen: () => void;
  onReportClose: () => void;
  onReportReasonChange: (value: string) => void;
  onReportDetailsChange: (value: string) => void;
  onReportSubmit: () => void;
  onContactUnlocked?: (phone: string) => void;
}>;

function valuationGradeClass(grade: string) {
  if (grade === "Good Deal") return "bg-emerald-500/20 text-emerald-700";
  if (grade === "Overpriced") return "bg-red-500/20 text-red-700";
  return "bg-gray-500/20 text-gray-700";
}

function renderValuationBody(valLoading: boolean, valuation: Valuation | undefined) {
  if (valLoading) {
    return <p className="text-xs text-muted-foreground mt-1">Calculating fair market rent...</p>;
  }
  if (!valuation) return null;
  return (
    <div className="mt-2 text-xs">
      <div className="flex justify-between items-center">
        <span>
          Estimated rent range:{" "}
          <strong className="text-foreground">{valuation.estimatedRentRange}</strong>
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${valuationGradeClass(valuation.valuationGrade)}`}
        >
          {valuation.valuationGrade}
        </span>
      </div>
      <p className="mt-2 text-muted-foreground leading-relaxed">{valuation.details}</p>
    </div>
  );
}

export function PropertyDetailContent({
  property: p,
  propertyId,
  userId,
  isPlus,
  landlordName,
  similar,
  valuation,
  valLoading,
  chatMessages,
  chatInput,
  chatLoading,
  onChatInputChange,
  onChatSubmit,
  isDemo,
  reportOpen,
  reportReason,
  reportDetails,
  reportSubmitting,
  onReportOpen,
  onReportClose,
  onReportReasonChange,
  onReportDetailsChange,
  onReportSubmit,
  onContactUnlocked,
}: PropertyDetailContentProps) {
  const vLevel = verificationLevel(p);
  const intel = getListingIntel(p);

  return (
    <div className="mx-auto max-w-2xl px-5 pt-5">
      <div className="relative">
        <div
          className={cn("transition duration-300", isDemo && "select-none blur-[6px]")}
          aria-hidden={isDemo ? true : undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold leading-tight">{p.title}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {p.neighborhood} · {intel.subArea}
                {p.address ? ` · ${p.address}` : ""}
              </p>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-semibold text-primary">
                {formatKes(p.rent_kes)}
              </div>
              <div className="text-xs text-muted-foreground">/month</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl border bg-card p-3">
            <PropertyStat icon={BedDouble} label="Beds" value={String(p.bedrooms)} />
            <PropertyStat icon={Bath} label="Baths" value={String(p.bathrooms)} />
            <PropertyStat
              icon={Square}
              label="Area"
              value={p.area_sqm ? `${p.area_sqm}m²` : "—"}
            />
            <PropertyStat
              icon={Calendar}
              label="Move-in"
              value={p.available_from ? new Date(p.available_from).toLocaleDateString() : "Now"}
            />
          </div>

          <div className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-sm">
            <span className="font-medium">Type:</span> {prettyType(p.property_type)} ·{" "}
            <span className="font-medium">Deposit:</span>{" "}
            {p.deposit_kes ? formatKes(p.deposit_kes) : "—"}
            {intel.parking ? " · Parking" : ""}
          </div>

          <PropertyIntelligencePanel intel={intel} />
        </div>
        {isDemo ? (
          <div
            className="pointer-events-none absolute inset-0 grid place-items-center rounded-3xl bg-background/30 px-5 text-center backdrop-blur-[1px]"
            aria-label={PREVIEW_LISTING_NOTICE}
          >
            <div className="rounded-2xl border bg-card/95 px-5 py-4 shadow-card">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Preview</p>
              <p className="mt-1 max-w-56 text-sm font-semibold leading-snug">
                Real property details are coming soon
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">Scam risk scan</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          NyumbaSearch Plus checks pricing, verification, and listing signals for red flags.
        </p>
        <div className="mt-3">
          <ScamRiskScanner listingId={propertyId} isPlus={isPlus} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">About this landlord</h2>
        <div className="mt-3 flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
            {landlordName.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold">{landlordName}</p>
            {vLevel > 0 && (
              <div className="mt-1">
                <VerificationBadge level={vLevel} />
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Contact details are unlocked separately — messaging requires Plus.
            </p>
          </div>
        </div>
        {!isDemo && (
          <div id="contact-unlock" className="mt-4">
            <ContactUnlockCard listing={p} onUnlocked={onContactUnlocked} />
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border bg-linear-to-r from-emerald-500/10 to-teal-500/10 p-4">
        <h3 className="font-display text-sm font-semibold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
          <Sparkles className="h-4 w-4" />
          AI Valuation Estimate
        </h3>
        {renderValuationBody(valLoading, valuation)}
      </section>

      <div className="relative mt-6">
        <div
          className={cn("transition duration-300", isDemo && "select-none blur-[6px]")}
          aria-hidden={isDemo ? true : undefined}
        >
          <section>
            <h2 className="font-display text-lg font-semibold">About this home</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
          </section>

          {p.amenities.length > 0 && (
            <section className="mt-6">
              <h2 className="font-display text-lg font-semibold">Amenities</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.amenities.map((a) => (
                  <span
                    key={a}
                    className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
        {isDemo ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-3xl bg-background/30 px-5 text-center backdrop-blur-[1px]">
            <div className="rounded-2xl border bg-card/95 px-5 py-4 shadow-card">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Preview</p>
              <p className="mt-1 max-w-56 text-sm font-semibold leading-snug">
                Uploaded listing descriptions will appear here
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <PropertyAiAssistant
        messages={chatMessages}
        chatInput={chatInput}
        chatLoading={chatLoading}
        onChatInputChange={onChatInputChange}
        onSubmit={onChatSubmit}
      />

      <PropertyRevenueBlocks property={p} isPlus={isPlus} />
      <PropertyReviewsSection propertyId={propertyId} userId={userId} isTenant={!!userId} />

      {!isDemo && (
        <PropertyReportSection
          reportOpen={reportOpen}
          reportReason={reportReason}
          reportDetails={reportDetails}
          reportSubmitting={reportSubmitting}
          onOpen={onReportOpen}
          onClose={onReportClose}
          onReasonChange={onReportReasonChange}
          onDetailsChange={onReportDetailsChange}
          onSubmit={onReportSubmit}
        />
      )}

      {similar.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Similar homes nearby</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {similar.map((item) => (
              <PropertyCard key={item.id} p={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
