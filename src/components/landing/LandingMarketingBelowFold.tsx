import {
  DownloadApp,
  LandlordBand,
  PropertyIntelSection,
  Testimonials,
  VerifiedSection,
  WhyNyumba,
  type FeaturedTestimonial,
  type PropertyIntelligenceStats,
} from "@/components/landing/LandingMarketingSections";

type Props = Readonly<{
  intelligenceStats: PropertyIntelligenceStats | undefined;
  intelligenceLoading: boolean;
  testimonials: FeaturedTestimonial[];
  testimonialsLoading: boolean;
}>;

/** Below-fold homepage marketing — lazy-loaded to keep first paint light. */
export function LandingMarketingBelowFold({
  intelligenceStats,
  intelligenceLoading,
  testimonials,
  testimonialsLoading,
}: Props) {
  return (
    <>
      <VerifiedSection />
      <PropertyIntelSection stats={intelligenceStats} loading={intelligenceLoading} />
      <WhyNyumba />
      <Testimonials items={testimonials} loading={testimonialsLoading} />
      <DownloadApp />
      <LandlordBand />
    </>
  );
}
