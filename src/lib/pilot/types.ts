/** Pilot partnership domain constants and pure helpers. */

export const PILOT_STATUSES = [
  "DRAFT",
  "INVITED",
  "APPLIED",
  "UNDER_REVIEW",
  "APPROVED",
  "ONBOARDING",
  "ACTIVE",
  "PAUSED",
  "EXTENDED",
  "COMPLETED",
  "CONVERTED",
  "DECLINED",
  "CANCELLED",
] as const;

export type PilotStatus = (typeof PILOT_STATUSES)[number];

export const PILOT_PARTNER_TYPES = [
  "REAL_ESTATE_AGENCY",
  "PROPERTY_DEVELOPER",
  "PROPERTY_MANAGER",
  "LANDLORD",
  "STUDENT_RESIDENCE",
  "PROPERTY_OWNER",
  "REAL_ESTATE_AGENT",
  "OTHER",
] as const;

export type PilotPartnerType = (typeof PILOT_PARTNER_TYPES)[number];

export const PILOT_PROPERTY_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "LIVE",
  "PAUSED",
  "REMOVED",
] as const;

export type PilotPropertyStatus = (typeof PILOT_PROPERTY_STATUSES)[number];

export const PILOT_EVENT_TYPES = [
  "PROPERTY_IMPRESSION",
  "PROPERTY_VIEW",
  "PROPERTY_SAVE",
  "CONTACT_CLICK",
  "CALL_CLICK",
  "WHATSAPP_CLICK",
  "ENQUIRY_SUBMITTED",
  "VIEWING_REQUESTED",
  "SHARE_CLICK",
  "DIRECTIONS_CLICK",
] as const;

export type PilotEventType = (typeof PILOT_EVENT_TYPES)[number];

export const PILOT_LEAD_TYPES = ["enquiry", "call", "whatsapp", "viewing", "general"] as const;
export type PilotLeadType = (typeof PILOT_LEAD_TYPES)[number];

export const PILOT_LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "VIEWING_SCHEDULED",
  "VIEWED",
  "CONVERTED",
  "LOST",
  "UNRESPONSIVE",
] as const;

export type PilotLeadStatus = (typeof PILOT_LEAD_STATUSES)[number];

export const CRM_PIPELINE_STATUSES = [
  "PROSPECT",
  "CONTACTED",
  "INTERESTED",
  "PROPOSAL_SENT",
  "FOLLOW_UP",
  "DEMO",
  "PILOT_PROPOSED",
  "INVITED",
  "ACTIVE_PILOT",
  "REVIEW",
  "CONVERTED",
] as const;

export type CrmPipelineStatus = (typeof CRM_PIPELINE_STATUSES)[number];

export const COMMERCIAL_MODELS = [
  "SUBSCRIPTION",
  "PREMIUM_LISTING",
  "LEAD_GENERATION",
  "REFERRAL",
  "PORTFOLIO_PARTNERSHIP",
  "CUSTOM",
] as const;

export type CommercialModel = (typeof COMMERCIAL_MODELS)[number];

export const INTENT_EVENT_TYPES = new Set<PilotEventType>([
  "PROPERTY_IMPRESSION",
  "PROPERTY_VIEW",
  "PROPERTY_SAVE",
  "SHARE_CLICK",
  "DIRECTIONS_CLICK",
]);

export const LEAD_EVENT_TYPES: Partial<Record<PilotEventType, PilotLeadType>> = {
  CALL_CLICK: "call",
  WHATSAPP_CLICK: "whatsapp",
  CONTACT_CLICK: "general",
  ENQUIRY_SUBMITTED: "enquiry",
  VIEWING_REQUESTED: "viewing",
};

/** Allowed admin/partner lifecycle transitions. */
const TRANSITIONS: Record<PilotStatus, readonly PilotStatus[]> = {
  DRAFT: ["INVITED", "CANCELLED"],
  INVITED: ["APPLIED", "UNDER_REVIEW", "ONBOARDING", "ACTIVE", "DECLINED", "CANCELLED"],
  APPLIED: ["UNDER_REVIEW", "DECLINED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "DECLINED", "CANCELLED"],
  APPROVED: ["ONBOARDING", "ACTIVE", "CANCELLED"],
  ONBOARDING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAUSED", "EXTENDED", "COMPLETED", "CONVERTED", "CANCELLED"],
  PAUSED: ["ACTIVE", "COMPLETED", "CANCELLED"],
  EXTENDED: ["ACTIVE", "COMPLETED", "CONVERTED", "CANCELLED"],
  COMPLETED: ["CONVERTED", "EXTENDED"],
  CONVERTED: [],
  DECLINED: [],
  CANCELLED: [],
};

export function canTransitionPilotStatus(from: PilotStatus, to: PilotStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function daysRemaining(endDate: string | null | undefined, now = new Date()): number | null {
  if (!endDate) return null;
  const end = new Date(`${endDate}T23:59:59.999Z`);
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function kpiProgress(
  actual: number,
  target: number,
): {
  percentage: number;
  status: "on_track" | "ahead" | "behind" | "met";
} {
  if (target <= 0) return { percentage: actual > 0 ? 100 : 0, status: "met" };
  const percentage = Math.round((actual / target) * 1000) / 10;
  if (percentage >= 100) return { percentage, status: "met" };
  if (percentage >= 80) return { percentage, status: "on_track" };
  if (percentage >= 100) return { percentage, status: "ahead" };
  return { percentage, status: "behind" };
}

export function slugifyPartnerName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("-")
    .slice(0, 60);
}

export function partnerTypeToOrgType(partnerType: PilotPartnerType): string {
  switch (partnerType) {
    case "REAL_ESTATE_AGENCY":
      return "agency";
    case "PROPERTY_DEVELOPER":
      return "developer";
    case "REAL_ESTATE_AGENT":
      return "agent";
    case "PROPERTY_MANAGER":
      return "property_manager";
    case "STUDENT_RESIDENCE":
      return "student_residence";
    case "PROPERTY_OWNER":
      return "property_owner";
    case "LANDLORD":
      return "landlord";
    default:
      return "other";
  }
}

/** App roles granted when a pilot invite is accepted. */
export function partnerTypeToAppRoles(
  partnerType: PilotPartnerType,
): Array<"landlord" | "manager" | "agency" | "property_developer" | "agent"> {
  switch (partnerType) {
    case "PROPERTY_DEVELOPER":
      return ["property_developer"];
    case "REAL_ESTATE_AGENT":
      return ["agent"];
    case "REAL_ESTATE_AGENCY":
      return ["agency"];
    case "PROPERTY_MANAGER":
      return ["manager"];
    case "LANDLORD":
    case "PROPERTY_OWNER":
      return ["landlord"];
    default:
      return ["landlord", "agency"];
  }
}

export function metricFromEventType(eventType: PilotEventType): keyof {
  impressions: number;
  views: number;
  saves: number;
  contact_clicks: number;
  call_clicks: number;
  whatsapp_clicks: number;
  enquiries: number;
  viewing_requests: number;
  share_clicks: number;
  directions_clicks: number;
} {
  switch (eventType) {
    case "PROPERTY_IMPRESSION":
      return "impressions";
    case "PROPERTY_VIEW":
      return "views";
    case "PROPERTY_SAVE":
      return "saves";
    case "CONTACT_CLICK":
      return "contact_clicks";
    case "CALL_CLICK":
      return "call_clicks";
    case "WHATSAPP_CLICK":
      return "whatsapp_clicks";
    case "ENQUIRY_SUBMITTED":
      return "enquiries";
    case "VIEWING_REQUESTED":
      return "viewing_requests";
    case "SHARE_CLICK":
      return "share_clicks";
    case "DIRECTIONS_CLICK":
      return "directions_clicks";
  }
}

export function eventTypeToKpiMetric(eventType: PilotEventType): string | null {
  switch (eventType) {
    case "PROPERTY_VIEW":
      return "property_views";
    case "PROPERTY_SAVE":
      return "property_saves";
    case "ENQUIRY_SUBMITTED":
      return "enquiries";
    case "CALL_CLICK":
      return "calls";
    case "WHATSAPP_CLICK":
      return "whatsapp";
    case "VIEWING_REQUESTED":
      return "viewing_requests";
    default:
      return null;
  }
}
