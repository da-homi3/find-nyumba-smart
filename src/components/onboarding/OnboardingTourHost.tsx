import { useAuth } from "@/hooks/use-auth";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import type { TourId } from "@/lib/onboarding/types";

type Props = Readonly<{
  tourId: TourId;
  /** Set false to only start manually (e.g. replay from settings) */
  autoStart?: boolean;
}>;

export function OnboardingTourHost({ tourId, autoStart = true }: Props) {
  const { user } = useAuth();
  const tour = useOnboardingTour(tourId, user?.id ?? null, autoStart);

  if (!tour.active || !tour.step) return null;

  return (
    <OnboardingTour
      open={tour.active}
      step={tour.step}
      stepIndex={tour.stepIndex}
      stepCount={tour.stepCount}
      onNext={tour.next}
      onPrev={tour.prev}
      onSkip={tour.skip}
    />
  );
}
