import type { ServiceProvider, AdUnit } from "@/lib/revenue/types";

export const SERVICE_CATEGORIES = [
  { id: "electricians", label: "Electricians", emoji: "🔌" },
  { id: "plumbers", label: "Plumbers", emoji: "🔧" },
  { id: "painters", label: "Painters & decorators", emoji: "🎨" },
  { id: "internet", label: "Internet installation", emoji: "📡" },
  { id: "security", label: "Security systems", emoji: "🔒" },
  { id: "movers", label: "Movers & relocation", emoji: "🛋️" },
  { id: "cleaning", label: "Cleaning services", emoji: "🧹" },
  { id: "solar", label: "Solar installation", emoji: "☀️" },
  { id: "pest_control", label: "Pest control & fumigation", emoji: "🐜" },
  { id: "carpentry", label: "Carpentry", emoji: "🪚" },
  { id: "furniture", label: "Furniture makers", emoji: "🪑" },
  { id: "interior_design", label: "Interior design", emoji: "🏠" },
  { id: "appliance_repair", label: "Appliance repair", emoji: "🔧" },
  { id: "gardening", label: "Gardening & landscaping", emoji: "🌿" },
  { id: "water_services", label: "Water & borehole services", emoji: "💧" },
  { id: "generators", label: "Generators & backup power", emoji: "⚡" },
  { id: "moving_supplies", label: "Moving supplies", emoji: "📦" },
  { id: "ac_repair", label: "AC & refrigeration", emoji: "❄️" },
  { id: "laundry", label: "Laundry & dry cleaning", emoji: "👔" },
  { id: "locksmiths", label: "Locksmiths", emoji: "🔑" },
];

export const MOCK_PROVIDERS: ServiceProvider[] = [
  {
    id: "p1",
    businessName: "Nairobi Plumbing Works",
    category: "plumbers",
    areasServed: ["Westlands", "Kilimani"],
    rating: 4.8,
    reviewCount: 124,
    startingPriceKes: 2000,
    description: "24/7 emergency plumbing across Nairobi.",
    phone: "+254712345678",
    subscriptionType: "monthly",
    monthlyFeeKes: 2000,
  },
  {
    id: "p2",
    businessName: "Kileleshwa Electric Co.",
    category: "electricians",
    areasServed: ["Kileleshwa", "Lavington"],
    rating: 4.6,
    reviewCount: 89,
    startingPriceKes: 1500,
    description: "Certified electricians for homes and apartments.",
    phone: "+254723456789",
    subscriptionType: "per-lead",
    perLeadFeeKes: 150,
  },
  {
    id: "p3",
    businessName: "SwiftMove Nairobi",
    category: "movers",
    areasServed: ["All Nairobi"],
    rating: 4.7,
    reviewCount: 210,
    startingPriceKes: 8000,
    description: "Professional movers with packing services.",
    phone: "+254734567890",
    subscriptionType: "monthly",
    monthlyFeeKes: 2000,
  },
  {
    id: "p4",
    businessName: "Zuku Install Pro",
    category: "internet",
    areasServed: ["Karen", "Runda", "Westlands"],
    rating: 4.5,
    reviewCount: 56,
    startingPriceKes: 2500,
    description: "Home fibre installation partner.",
    phone: "+254745678901",
    subscriptionType: "per-lead",
    perLeadFeeKes: 150,
  },
];

export const MOCK_ADS: AdUnit[] = [
  {
    id: "ad1",
    advertiserName: "Zuku Fiber",
    placement: "homepage-banner",
    imageUrl: "",
    linkUrl: "#",
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    amountPaidKes: 5000,
  },
  {
    id: "ad2",
    advertiserName: "Hotpoint Furniture",
    placement: "browse-sidebar",
    imageUrl: "",
    linkUrl: "#",
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    amountPaidKes: 5000,
  },
];

export const ADMIN_REVENUE_MOCK = [
  { month: "Jan", mrr: 45000, boosts: 12000, verification: 8000, leads: 5000, plus: 2000 },
  { month: "Feb", mrr: 120000, boosts: 28000, verification: 15000, leads: 12000, plus: 8000 },
  { month: "Mar", mrr: 280000, boosts: 45000, verification: 42000, leads: 25000, plus: 18000 },
  { month: "Apr", mrr: 450000, boosts: 62000, verification: 68000, leads: 48000, plus: 35000 },
  { month: "May", mrr: 680000, boosts: 85000, verification: 95000, leads: 72000, plus: 58000 },
  { month: "Jun", mrr: 950000, boosts: 110000, verification: 120000, leads: 98000, plus: 82000 },
];

export function providersForCategory(category: string): ServiceProvider[] {
  const base = MOCK_PROVIDERS.filter((p) => p.category === category);
  if (base.length >= 4) return base;
  const extras = MOCK_PROVIDERS.filter((p) => p.category !== category).slice(0, 4 - base.length);
  return [...base, ...extras.map((p, i) => ({ ...p, id: `${p.id}-x${i}`, category }))];
}
