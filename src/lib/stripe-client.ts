/** Client-safe check — publishable key only, never the secret key. */
export function isStripeCheckoutEnabled(): boolean {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
  return Boolean(key?.trim());
}
