import { sendTemplate } from "@/lib/whatsapp/client";

export async function notifyViewingConfirmed(
  waPhone: string,
  tenantName: string,
  listingTitle: string,
  date: string,
  time: string,
  address: string,
): Promise<void> {
  await sendTemplate(waPhone, "ns_viewing_confirmed", "en", [
    {
      type: "body",
      parameters: [
        { type: "text", text: tenantName },
        { type: "text", text: listingTitle },
        { type: "text", text: date },
        { type: "text", text: time },
        { type: "text", text: address },
      ],
    },
  ]);
}

export async function notifyLandlordNewLead(
  waPhone: string,
  listingTitle: string,
  neighbourhood: string,
): Promise<void> {
  await sendTemplate(waPhone, "ns_new_lead", "en", [
    {
      type: "body",
      parameters: [
        { type: "text", text: listingTitle },
        { type: "text", text: neighbourhood },
      ],
    },
  ]);
}

export async function notifyListingApproved(
  waPhone: string,
  name: string,
  title: string,
  propertyId: string,
): Promise<void> {
  await sendTemplate(waPhone, "ns_listing_approved", "en", [
    {
      type: "body",
      parameters: [
        { type: "text", text: name },
        { type: "text", text: title },
        { type: "text", text: propertyId },
      ],
    },
  ]);
}

export async function notifyListingRejected(
  waPhone: string,
  name: string,
  title: string,
  reason: string,
): Promise<void> {
  await sendTemplate(waPhone, "ns_listing_rejected", "en", [
    {
      type: "body",
      parameters: [
        { type: "text", text: name },
        { type: "text", text: title },
        { type: "text", text: reason },
      ],
    },
  ]);
}

export async function notifyTrialEnding(
  waPhone: string,
  name: string,
  unlocksRemaining: number,
): Promise<void> {
  await sendTemplate(waPhone, "ns_trial_ending", "en", [
    {
      type: "body",
      parameters: [
        { type: "text", text: name },
        { type: "text", text: String(unlocksRemaining) },
      ],
    },
  ]);
}

export async function notifyPaymentConfirmed(
  waPhone: string,
  amount: number,
  method: string,
  description: string,
  ref: string,
): Promise<void> {
  await sendTemplate(waPhone, "ns_payment_confirmed", "en", [
    {
      type: "body",
      parameters: [
        { type: "text", text: amount.toLocaleString() },
        { type: "text", text: method === "mpesa" ? "M-Pesa" : "Card" },
        { type: "text", text: description },
        { type: "text", text: ref },
      ],
    },
  ]);
}

export async function notifyWelcome(waPhone: string, firstName: string): Promise<void> {
  await sendTemplate(waPhone, "ns_welcome", "en", [
    { type: "body", parameters: [{ type: "text", text: firstName }] },
  ]);
}
