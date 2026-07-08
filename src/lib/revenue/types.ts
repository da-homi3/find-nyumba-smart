export type LandlordPlan =
  | "free"
  | "pro"
  | "premium"
  | "manager-solo"
  | "manager-team"
  | "manager-enterprise"
  | "agency-starter"
  | "agency-pro"
  | "agency-enterprise";

export type TenantPlan = "free" | "plus";

export type BoostPackage = "spotlight" | "homepage" | "campaign";

export type VerificationTier = "basic" | "standard" | "express";

export type PaymentMethod = "mpesa" | "card";

export interface Subscription {
  id: string;
  userId: string;
  plan: LandlordPlan | TenantPlan;
  status: "active" | "cancelled" | "past_due";
  startDate: string;
  nextBillingDate: string;
  amountKes: number;
  paymentMethod: PaymentMethod;
  billingCycle: "monthly" | "quarterly";
}

export interface ListingBoost {
  id: string;
  listingId: string;
  package: BoostPackage;
  startDate: string;
  endDate: string;
  amountPaidKes: number;
  placements: ("search-top" | "homepage" | "newsletter" | "push")[];
}

export interface VerificationRequest {
  id: string;
  propertyAddress: string;
  listingUrl?: string;
  requesterName: string;
  requesterPhone: string;
  requesterEmail: string;
  tier: VerificationTier;
  amountPaidKes: number;
  status: "pending" | "in-progress" | "complete" | "failed";
  reportUrl?: string;
}

export interface Lead {
  id: string;
  listingId: string;
  landlordId: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string | null;
  tenantEmail: string | null;
  qualityScore: 1 | 2 | 3 | 4 | 5;
  source: "view" | "save" | "message" | "booking";
  createdAt: string;
}

export interface Transaction {
  id: string;
  listingId: string;
  landlordId: string;
  tenantId: string | null;
  rentAmountKes: number;
  platformFeeKes: number;
  status: "pending" | "paid" | "disputed";
  date: string;
}

export interface ServiceProvider {
  id: string;
  businessName: string;
  category: string;
  areasServed: string[];
  rating: number;
  reviewCount: number;
  startingPriceKes: number;
  description: string;
  phone: string;
  subscriptionType: "monthly" | "per-lead";
  monthlyFeeKes?: number;
  perLeadFeeKes?: number;
}

export interface AdUnit {
  id: string;
  advertiserName: string;
  placement: "homepage-banner" | "browse-sidebar" | "detail-page" | "newsletter";
  imageUrl: string;
  linkUrl: string;
  startDate: string;
  endDate: string;
  amountPaidKes: number;
}

export type CheckoutProduct =
  | { kind: "landlord-plan"; planId: LandlordPlan }
  | { kind: "tenant-plan"; planId: "plus"; cycle: "monthly" | "quarterly" }
  | { kind: "boost"; package: BoostPackage; propertyId?: string }
  | { kind: "lead-pack"; qty: number }
  | { kind: "verification"; tier: VerificationTier }
  | { kind: "report"; reportId: string };
