/** Client-safe flag — card checkout is enabled when Pesapal is configured server-side. */
export function isPesapalCheckoutEnabled(): boolean {
  return import.meta.env.VITE_PESAPAL_CHECKOUT_ENABLED === "1";
}
