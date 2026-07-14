import { formatKes } from "@/lib/properties";
import type { BoostPackage, LandlordPlan, VerificationTier } from "@/lib/revenue/types";
import type { ListingPortal } from "@/lib/portal-paths";
export { LISTING_LIMITS } from "@/lib/revenue/plan-limits";

export type PlanCardDef = {
  id: string;
  name: string;
  priceKes: number;
  priceLabel?: string;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  ctaTo: string;
  highlighted?: boolean;
  badge?: string;
};

export const LANDLORD_PLANS: PlanCardDef[] = [
  {
    id: "free",
    name: "Free",
    priceKes: 0,
    period: "/ month",
    desc: "Get started with multiple listings at no cost.",
    features: [
      "Up to 9 active listings",
      "Basic analytics (views only)",
      "Manual verification (Level 1)",
      "Standard search placement",
    ],
    cta: "Get started free",
    ctaTo: "/landlord",
  },
  {
    id: "pro",
    name: "Pro",
    priceKes: 999,
    period: "/ month",
    desc: "For active landlords with multiple units.",
    features: [
      "Up to 10 active listings",
      "Full analytics (views, saves, inquiries)",
      "Priority verification (Level 2 within 48hrs)",
      "1 featured search slot included",
      "Direct tenant messaging",
      "Vacancy status management",
    ],
    cta: "Start Pro",
    ctaTo: "/landlord/checkout?plan=pro",
    highlighted: true,
    badge: "Most popular",
  },
  {
    id: "premium",
    name: "Premium",
    priceKes: 2999,
    period: "/ month",
    desc: "Scale with AI insights and homepage visibility.",
    features: [
      "Up to 30 active listings",
      "Everything in Pro",
      "AI pricing suggestions",
      "Homepage featured slot (1/month)",
      "Dedicated WhatsApp support",
    ],
    cta: "Start Premium",
    ctaTo: "/landlord/checkout?plan=premium",
  },
];

export const AGENCY_PLANS: PlanCardDef[] = [
  {
    id: "agency-starter",
    name: "Starter Agency",
    priceKes: 5000,
    period: "/ month",
    desc: "Small agencies getting started on NyumbaSearch.",
    features: [
      "Up to 20 listings",
      "Team access (2 users)",
      "Agency profile page",
      "Lead management dashboard",
    ],
    cta: "Start Starter",
    ctaTo: "/agency/checkout?plan=agency-starter",
  },
  {
    id: "agency-pro",
    name: "Professional Agency",
    priceKes: 10000,
    period: "/ month",
    desc: "Growing portfolios with priority placement.",
    features: [
      "Up to 100 listings",
      "Team access (10 users)",
      "Everything in Starter",
      "Priority search placement",
      "Weekly performance reports",
    ],
    cta: "Go Professional",
    ctaTo: "/agency/checkout?plan=agency-pro",
    highlighted: true,
  },
  {
    id: "agency-enterprise",
    name: "Enterprise Agency",
    priceKes: 15000,
    period: "/ month",
    desc: "Unlimited scale with dedicated support.",
    features: [
      "Unlimited listings",
      "Unlimited team users",
      "Everything in Professional",
      "Dedicated account manager",
      "Custom integrations",
      "White-label options",
    ],
    cta: "Contact us",
    ctaTo: "/contact?subject=enterprise",
  },
];

export const MANAGER_PLANS: PlanCardDef[] = [
  {
    id: "manager-solo",
    name: "Solo Manager",
    priceKes: 2500,
    period: "/ month",
    desc: "Independent property managers handling a handful of owners.",
    features: [
      "Up to 25 managed units",
      "Team access (2 users)",
      "Assign units to landlord clients",
      "Lead management dashboard",
      "Priority verification (Level 2 within 48hrs)",
    ],
    cta: "Start Solo",
    ctaTo: "/manager/checkout?plan=manager-solo",
  },
  {
    id: "manager-team",
    name: "Management Team",
    priceKes: 7500,
    period: "/ month",
    desc: "Growing firms managing multiple client portfolios.",
    features: [
      "Up to 100 managed units",
      "Team access (8 users)",
      "Everything in Solo",
      "Bulk import & portal integrations",
      "Priority search placement",
      "Monthly performance reports",
    ],
    cta: "Go Team",
    ctaTo: "/manager/checkout?plan=manager-team",
    highlighted: true,
    badge: "Most popular",
  },
  {
    id: "manager-enterprise",
    name: "Enterprise Manager",
    priceKes: 10000,
    period: "/ month",
    desc: "Large management companies with unlimited scale.",
    features: [
      "Unlimited managed units",
      "Unlimited team users",
      "Everything in Team",
      "Dedicated account manager",
      "Custom integrations & API",
      "White-label owner portals",
    ],
    cta: "Contact us",
    ctaTo: "/contact?subject=manager-enterprise",
  },
];

/** Payment plans shown on and charged from each listing dashboard. */
export const PORTAL_PLANS: Record<ListingPortal, PlanCardDef[]> = {
  landlord: LANDLORD_PLANS,
  manager: MANAGER_PLANS,
  agency: AGENCY_PLANS,
};

/** Plan pre-selected when a portal user taps "Upgrade". */
export const PORTAL_UPGRADE_PLAN: Record<ListingPortal, LandlordPlan> = {
  landlord: "pro",
  manager: "manager-team",
  agency: "agency-pro",
};

/** Resolve a plan id to one that belongs to the given portal, else its default upgrade plan. */
export function resolvePortalPlan(portal: ListingPortal, planId: string | undefined): LandlordPlan {
  const belongs = PORTAL_PLANS[portal].some((p) => p.id === planId);
  return belongs ? (planId as LandlordPlan) : PORTAL_UPGRADE_PLAN[portal];
}

export const BOOST_PACKAGES: {
  id: BoostPackage;
  name: string;
  placement: string;
  durationDays: number;
  priceKes: number;
  priceRange?: string;
  badge?: string;
}[] = [
  {
    id: "spotlight",
    name: "Spotlight",
    placement: "Featured at the top of search results in your neighbourhood for 7 days",
    durationDays: 7,
    priceKes: 2500,
    badge: "Spotlight",
  },
  {
    id: "homepage",
    name: "Homepage Feature",
    placement: 'Listed in the "Featured Homes" section on the homepage for 14 days',
    durationDays: 14,
    priceKes: 5000,
    badge: "Homepage",
  },
  {
    id: "campaign",
    name: "Full Campaign",
    placement: "Homepage + top search + email newsletter mention for 30 days",
    durationDays: 30,
    priceKes: 12000,
    priceRange: "KES 12,000",
    badge: "Campaign",
  },
];

export const PLUS_PLAN = {
  monthlyKes: 500,
  quarterlyKes: 1500,
  features: [
    "Unlimited contact unlocks on every listing",
    "In-app messaging with landlords and service providers",
    "Scam-risk scores on every property you view",
    "Early access: new listings 24hrs before public",
    "Unlimited saved searches with instant alerts",
    "Monthly market report by neighborhood",
  ],
};

export const PROVIDER_TIERS = [
  { value: "basic" as const, label: "Basic", priceKes: 500, desc: "Listed in category directory" },
  {
    value: "featured" as const,
    label: "Featured",
    priceKes: 1500,
    desc: "Higher placement + Featured badge",
  },
  {
    value: "premium" as const,
    label: "Premium",
    priceKes: 2500,
    desc: "Top placement + multiple categories",
  },
];

export function providerTierPrice(tier: string): number {
  return PROVIDER_TIERS.find((t) => t.value === tier)?.priceKes ?? 500;
}

export const REPORT_CATALOG: {
  id: string;
  name: string;
  priceKes: number;
  description: string;
}[] = [
  {
    id: "quarterly-overview",
    name: "Nairobi Rental Market Overview",
    priceKes: 5000,
    description: "Quarterly rental trends across Nairobi neighborhoods.",
  },
  {
    id: "neighborhood-deep-dive",
    name: "Neighborhood Deep Dive",
    priceKes: 8000,
    description: "Detailed supply, demand, and pricing for one neighborhood.",
  },
  {
    id: "annual",
    name: "Annual Housing Market Report",
    priceKes: 25000,
    description: "Full-year market analysis with forecasts.",
  },
];

export const LEAD_PACKS = [
  { qty: 10, priceKes: 1800, label: "10 rental leads" },
  { qty: 25, priceKes: 4000, label: "25 rental leads" },
  { qty: 50, priceKes: 7500, label: "50 rental leads" },
];

export const VERIFICATION_TIERS: {
  id: VerificationTier;
  name: string;
  priceKes: number;
  turnaround: string;
}[] = [
  { id: "basic", name: "Basic verification", priceKes: 1000, turnaround: "3 business days" },
  { id: "standard", name: "Standard verification", priceKes: 2500, turnaround: "48 hours" },
  { id: "express", name: "Express verification", priceKes: 5000, turnaround: "24 hours" },
];

export function planPriceLabel(plan: PlanCardDef): string {
  if (plan.priceLabel) return plan.priceLabel;
  return formatKes(plan.priceKes);
}

export function resolveLandlordPlan(planId: string | undefined): LandlordPlan {
  const valid: LandlordPlan[] = [
    "free",
    "pro",
    "premium",
    "manager-solo",
    "manager-team",
    "manager-enterprise",
    "agency-starter",
    "agency-pro",
    "agency-enterprise",
  ];
  return valid.includes(planId as LandlordPlan) ? (planId as LandlordPlan) : "pro";
}

export function planMonthlyPrice(planId: LandlordPlan, cycle: "monthly" | "quarterly"): number {
  const all = [...LANDLORD_PLANS, ...MANAGER_PLANS, ...AGENCY_PLANS];
  const plan = all.find((p) => p.id === planId);
  const base = plan?.priceKes ?? 999;
  if (cycle === "quarterly") return Math.round(base * 3 * 0.9);
  return base;
}

export function boostPrice(packageId: BoostPackage, _customCampaignKes?: number): number {
  return BOOST_PACKAGES.find((p) => p.id === packageId)?.priceKes ?? 2500;
}

export const ADVERTISE_PACKAGES = [
  {
    id: "listing_banner",
    name: "Listing page banner",
    placement: "Browse & property pages",
    priceKes: 15000,
  },
  {
    id: "homepage_hero",
    name: "Homepage featured slot",
    placement: "Homepage hero",
    priceKes: 35000,
  },
  {
    id: "neighbourhood",
    name: "Neighbourhood sponsor",
    placement: "Neighbourhood search results",
    priceKes: 10000,
  },
  {
    id: "email_newsletter",
    name: "Email newsletter inclusion",
    placement: "Weekly tenant email",
    priceKes: 8000,
  },
  {
    id: "category_sponsor",
    name: "Service category sponsor",
    placement: "Services directory",
    priceKes: 6000,
  },
  {
    id: "whatsapp_blast",
    name: "WhatsApp broadcast",
    placement: "WhatsApp tenant list",
    priceKes: 20000,
  },
  {
    id: "custom",
    name: "Custom package",
    placement: "Tailored placements",
    priceKes: 25000,
  },
] as const;

export type AdvertisePackageId = (typeof ADVERTISE_PACKAGES)[number]["id"];

export function advertisePackagePrice(packageId: string): number {
  return ADVERTISE_PACKAGES.find((p) => p.id === packageId)?.priceKes ?? 15000;
}

export function transactionReference(): string {
  const refBuf = new Uint32Array(1);
  crypto.getRandomValues(refBuf);
  return `NS-${10000000 + (refBuf[0] % 90000000)}`;
}
