import type { AlertSeverity } from "@/lib/alerts/fire-alert";

/** Plain-text labels for WhatsApp, email, and alerts (no emoji). */
export const Msg = {
  ok: "OK",
  failed: "Failed",
  pending: "Pending",
  live: "Live",

  searchHomes: "Search homes",
  findHome: "Find a home",
  listProperty: "List property",
  services: "Services",
  mainMenu: "Main menu",
  menu: "Menu",
  addListing: "Add listing",
  addFirst: "Add first",
  myListings: "My listings",
  listings: "Listings",
  viewLeads: "View leads",
  leads: "Leads",
  myProfile: "My profile",
  profile: "Profile",
  inquiries: "Inquiries",
  register: "Register",
  linkAccount: "Link account",
  askNyumbaAi: "Ask NyumbaAI",
  nyumbaAi: "NyumbaAI",
  details: "Details",
  contact: "Contact",
  getContact: "Get contact",
  bookViewing: "Book viewing",
  tryAgain: "Try again",
  retry: "Retry",
  searchAgain: "Search again",
  submit: "Submit",
  startOver: "Start over",
  view: "View",
  another: "Another question",

  viewingReminder: "Viewing reminder",
  location: "Location",
  locationPin: "location pin",
  rent: "Rent",
  photos: "Photos",
  savedHomes: "Your saved homes",
  upcomingViewings: "Your upcoming viewings",
  landlordContact: "Landlord contact",
  payment: "Payment",
  pickDate: "Pick a date",

  roleTenant: "Tenant — find a home",
  roleLandlord: "Landlord — list property",
  roleProvider: "Service provider",

  plus: "Plus",
  plusMember: "Plus member",
  plusIncluded: "Included with your Plus subscription.",

  verified: "[Verified]",
  trusted: "[Trusted]",
  newListing: "[New]",

  foundingMember: "FOUNDING MEMBER",
  bonusListings: "bonus listing slots",
  verificationComplete: "Verification complete",
} as const;

export function listingTrustBadge(isVerified: boolean, score: number): string {
  if (isVerified) return Msg.verified;
  if (score >= 70) return Msg.trusted;
  return Msg.newListing;
}

export function alertSeverityPrefix(severity: AlertSeverity): string {
  if (severity === "critical") return "[CRITICAL]";
  if (severity === "warning") return "[WARNING]";
  return "[INFO]";
}
