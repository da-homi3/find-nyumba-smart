/** Client-safe flag — card checkout is enabled when Pesapal is configured server-side. */
export function isPesapalCheckoutEnabled(): boolean {
  const raw = import.meta.env.VITE_PESAPAL_CHECKOUT_ENABLED;
  return raw === "1" || raw === "true" || raw === true;
}
