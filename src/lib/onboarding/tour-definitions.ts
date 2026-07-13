import type { TourDefinition, TourId } from "@/lib/onboarding/types";

const PORTAL_NAV_STEPS = [
  {
    title: "Welcome to your dashboard",
    body: "This quick tour shows where to manage listings, leads, and your subscription. You can skip anytime.",
  },
  {
    target: '[data-tour="portal-nav-dashboard"]',
    title: "Overview",
    body: "See property counts, views, leads, and viewing requests at a glance.",
    placement: "right" as const,
  },
  {
    target: '[data-tour="portal-nav-properties"]',
    title: "Properties",
    body: "Add, edit, and boost your listings. Each property can only be listed once on NyumbaSearch.",
    placement: "right" as const,
  },
  {
    target: '[data-tour="portal-add-property"]',
    title: "Add a property",
    body: "Start here to publish a new verified listing with photos, rent, and location.",
    placement: "top" as const,
  },
  {
    target: '[data-tour="portal-nav-leads"]',
    title: "Messages & leads",
    body: "Tenant inquiries and viewing requests land here — reply quickly to convert leads.",
    placement: "right" as const,
  },
  {
    target: '[data-tour="portal-nav-plan"]',
    title: "Your plan",
    body: "Upgrade for more listings, analytics, and featured placement tailored to your portal.",
    placement: "right" as const,
  },
];

export const TOUR_DEFINITIONS: Record<TourId, TourDefinition> = {
  "tenant-browse": {
    id: "tenant-browse",
    title: "Find a home",
    steps: [
      {
        title: "Welcome to NyumbaSearch",
        body: "Browse verified homes with no agent fees. This short tour shows how to search and save listings.",
      },
      {
        target: '[data-tour="tenant-search"]',
        title: "Search",
        body: "Search by neighbourhood, property type, or keyword. Tap the map icon for the map view.",
        placement: "bottom",
      },
      {
        target: '[data-tour="tenant-filters"]',
        title: "Filters",
        body: "Narrow by budget, bedrooms, and amenities. Results update as you adjust filters.",
        placement: "bottom",
      },
      {
        target: '[data-tour="tenant-listings"]',
        title: "Listings",
        body: "Tap a card for details, contact the landlord, or book a viewing. Verified badges mean NyumbaSearch checked the listing.",
        placement: "top",
      },
      {
        target: '[data-tour="tenant-bottom-nav"]',
        title: "Navigation",
        body: "Use the bottom bar for Browse, Map, Saved homes, and Messages.",
        placement: "top",
      },
    ],
  },
  "tenant-saved": {
    id: "tenant-saved",
    title: "Saved homes",
    steps: [
      {
        title: "Your shortlist",
        body: "Homes you save appear here so you can compare and contact landlords later.",
      },
      {
        target: '[data-tour="tenant-saved-list"]',
        title: "Saved listings",
        body: "Tap any saved home to open it. Sign in is required to save — your list syncs across devices.",
        placement: "top",
      },
    ],
  },
  "tenant-profile": {
    id: "tenant-profile",
    title: "Your profile",
    steps: [
      {
        title: "Account settings",
        body: "Manage your contact details and NyumbaSearch Plus subscription from here.",
      },
      {
        target: '[data-tour="tenant-profile-details"]',
        title: "Profile details",
        body: "Keep your name and phone updated — landlords see this when you inquire or book viewings.",
        placement: "bottom",
      },
      {
        target: '[data-tour="tenant-profile-plus"]',
        title: "NyumbaSearch Plus",
        body: "Upgrade for unlimited contact unlocks, scam-risk scores, and early access to new listings.",
        placement: "top",
      },
    ],
  },
  "tenant-messages": {
    id: "tenant-messages",
    title: "Messages",
    steps: [
      {
        title: "Inbox",
        body: "Conversations with landlords and service providers appear here after you contact them.",
      },
      {
        target: '[data-tour="tenant-messages-list"]',
        title: "Threads",
        body: "Open a thread to continue the conversation. Plus members can message directly in the app.",
        placement: "top",
      },
    ],
  },
  "landlord-dashboard": {
    id: "landlord-dashboard",
    title: "Landlord portal",
    steps: PORTAL_NAV_STEPS,
  },
  "manager-dashboard": {
    id: "manager-dashboard",
    title: "Property manager portal",
    steps: [
      ...PORTAL_NAV_STEPS.slice(0, 5),
      {
        target: '[data-tour="portal-nav-team"]',
        title: "Team",
        body: "Invite staff to help manage properties and leads under your organization.",
        placement: "right",
      },
      PORTAL_NAV_STEPS[5]!,
    ],
  },
  "agency-dashboard": {
    id: "agency-dashboard",
    title: "Agency portal",
    steps: [
      ...PORTAL_NAV_STEPS.slice(0, 5),
      {
        target: '[data-tour="portal-nav-team"]',
        title: "Team",
        body: "Add agents to your agency workspace with role-based access.",
        placement: "right",
      },
      PORTAL_NAV_STEPS[5]!,
    ],
  },
  "caretaker-dashboard": {
    id: "caretaker-dashboard",
    title: "Caretaker dashboard",
    steps: [
      {
        title: "Caretaker access",
        body: "You can update vacancy status and view scheduled viewings for assigned properties only.",
      },
      {
        target: '[data-tour="caretaker-viewings"]',
        title: "Upcoming viewings",
        body: "See when tenants are scheduled to visit properties you manage on-site.",
        placement: "bottom",
      },
      {
        target: '[data-tour="caretaker-quick-replies"]',
        title: "Quick replies",
        body: "Copy ready-made replies for common tenant questions.",
        placement: "bottom",
      },
      {
        target: '[data-tour="caretaker-properties"]',
        title: "Your properties",
        body: "Toggle vacancy when a unit is occupied or available — landlords see updates instantly.",
        placement: "top",
      },
    ],
  },
  "provider-dashboard": {
    id: "provider-dashboard",
    title: "Service provider",
    steps: [
      {
        title: "Provider dashboard",
        body: "Manage your business listing, subscription tier, and tenant inquiries.",
      },
      {
        target: '[data-tour="provider-subscription"]',
        title: "Subscription",
        body: "Choose a plan for higher placement in the services directory. Pay with M-Pesa or card.",
        placement: "bottom",
      },
      {
        target: '[data-tour="provider-inquiries"]',
        title: "Inquiries",
        body: "Respond to tenants via WhatsApp or phone. Faster replies improve your ranking.",
        placement: "top",
      },
    ],
  },
  "admin-dashboard": {
    id: "admin-dashboard",
    title: "Admin console",
    steps: [
      {
        title: "Operations console",
        body: "Review verifications, portal applications, providers, and platform safety reports.",
      },
      {
        target: '[data-tour="admin-tabs"]',
        title: "Tabs",
        body: "Switch between verifications, applications, providers, scams, and property checks.",
        placement: "bottom",
      },
      {
        target: '[data-tour="admin-content"]',
        title: "Queue",
        body: "Approve or reject items in the active tab. Actions are logged for audit.",
        placement: "top",
      },
    ],
  },
  "services-directory": {
    id: "services-directory",
    title: "Services directory",
    steps: [
      {
        title: "Home services",
        body: "Find verified electricians, plumbers, movers, and more across Kenya.",
      },
      {
        target: '[data-tour="services-categories"]',
        title: "Categories",
        body: "Pick a category to browse providers. Filter by county on category pages.",
        placement: "bottom",
      },
      {
        target: '[data-tour="services-register"]',
        title: "List your business",
        body: "Service providers can register here and choose a subscription plan after approval.",
        placement: "top",
      },
    ],
  },
};

export function getTourDefinition(tourId: TourId): TourDefinition {
  return TOUR_DEFINITIONS[tourId];
}
