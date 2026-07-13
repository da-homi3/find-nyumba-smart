import { useCallback, useEffect, useState } from "react";
import { getTourDefinition } from "@/lib/onboarding/tour-definitions";
import {
  consumeSignupTourPending,
  markTourCompleted,
  peekSignupTourPending,
  shouldAutoStartTour,
  tourIdForSignupRole,
} from "@/lib/onboarding/tour-storage";
import type { TourId } from "@/lib/onboarding/types";

export function useOnboardingTour(tourId: TourId, userId: string | null, autoStart = true) {
  const definition = getTourDefinition(tourId);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const step = definition.steps[stepIndex];
  const isLast = stepIndex >= definition.steps.length - 1;

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
    const pending = peekSignupTourPending();
    if (pending && tourIdForSignupRole(pending) === tourId) {
      consumeSignupTourPending();
    }
  }, [tourId]);

  const complete = useCallback(() => {
    markTourCompleted(tourId, userId);
    setActive(false);
    setStepIndex(0);
  }, [tourId, userId]);

  const skip = useCallback(() => {
    complete();
  }, [complete]);

  const next = useCallback(() => {
    if (isLast) {
      complete();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [complete, isLast]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!autoStart || active) return;
    if (!shouldAutoStartTour(tourId, userId)) return;
    const timer = globalThis.setTimeout(() => start(), 900);
    return () => globalThis.clearTimeout(timer);
  }, [autoStart, active, tourId, userId, start]);

  return {
    definition,
    active,
    step,
    stepIndex,
    stepCount: definition.steps.length,
    isLast,
    start,
    next,
    prev,
    skip,
    complete,
  };
}
