/** Framer Motion timing — mirrors CSS tokens in styles.css */
export const MOTION_EASE = [0.16, 1, 0.3, 1] as const;

export const MOTION_DURATION = {
  micro: 0.15,
  fast: 0.25,
  medium: 0.45,
  slow: 0.7,
} as const;

export const MOTION_STAGGER = 0.07;

/** Standard entrance: fade + vertical shift (no scale on page load). */
export const entranceInitial = { opacity: 0, y: 12 };
export const entranceAnimate = { opacity: 1, y: 0 };

/** Above-the-fold motion: never hide SSR HTML (avoids blank dark screen before hydration). */
export const SSR_SAFE_MOTION_INITIAL = false;

export function staggerDelay(index: number, max = 120): number {
  return Math.min(index * MOTION_STAGGER * 1000, max) / 1000;
}
