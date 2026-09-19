export type ListingPortal =
  | "landlord"
  | "manager"
  | "agency"
  | "property_developer"
  | "agent";

export type PortalPaths = {
  dashboard: string;
  properties: string;
  propertiesNew: string;
  import: string;
  integrations: string;
  leads: string;
  caretakers: string;
  analytics: string;
  plan: string;
  billing: string;
  checkout: string;
  team?: string;
};

export function listerPortalFromRoles(roles: {
  isLandlord?: boolean;
  isManager?: boolean;
  isAgency?: boolean;
  isPropertyDeveloper?: boolean;
  isAgent?: boolean;
}): ListingPortal {
  if (roles.isPropertyDeveloper) return "property_developer";
  if (roles.isAgent) return "agent";
  if (roles.isAgency) return "agency";
  if (roles.isManager) return "manager";
  return "landlord";
}

export const PORTAL_PATHS: Record<ListingPortal, PortalPaths> = {
  landlord: {
    dashboard: "/landlord/dashboard",
    properties: "/landlord/properties",
    propertiesNew: "/landlord/properties/new",
    import: "/landlord/import",
    integrations: "/landlord/integrations",
    leads: "/landlord/leads",
    caretakers: "/landlord/caretakers",
    analytics: "/landlord/analytics",
    plan: "/landlord/dashboard/plan",
    billing: "/landlord/dashboard/billing",
    checkout: "/landlord/checkout",
  },
  manager: {
    dashboard: "/manager/dashboard",
    properties: "/manager/properties",
    propertiesNew: "/manager/properties/new",
    import: "/manager/import",
    integrations: "/manager/integrations",
    leads: "/manager/leads",
    caretakers: "/manager/caretakers",
    analytics: "/manager/analytics",
    plan: "/manager/dashboard/plan",
    billing: "/manager/dashboard/billing",
    checkout: "/manager/checkout",
    team: "/manager/team",
  },
  agency: {
    dashboard: "/agency/dashboard",
    properties: "/agency/properties",
    propertiesNew: "/agency/properties/new",
    import: "/agency/import",
    integrations: "/agency/integrations",
    leads: "/agency/leads",
    caretakers: "/agency/caretakers",
    analytics: "/agency/analytics",
    plan: "/agency/dashboard/plan",
    billing: "/agency/dashboard/billing",
    checkout: "/agency/checkout",
    team: "/agency/team",
  },
  property_developer: {
    dashboard: "/developer/dashboard",
    properties: "/developer/properties",
    propertiesNew: "/developer/properties/new",
    import: "/developer/import",
    integrations: "/developer/integrations",
    leads: "/developer/leads",
    caretakers: "/developer/caretakers",
    analytics: "/developer/analytics",
    plan: "/developer/dashboard/plan",
    billing: "/developer/dashboard/billing",
    checkout: "/developer/checkout",
    team: "/developer/team",
  },
  agent: {
    dashboard: "/agent/dashboard",
    properties: "/agent/properties",
    propertiesNew: "/agent/properties/new",
    import: "/agent/import",
    integrations: "/agent/integrations",
    leads: "/agent/leads",
    caretakers: "/agent/caretakers",
    analytics: "/agent/analytics",
    plan: "/agent/dashboard/plan",
    billing: "/agent/dashboard/billing",
    checkout: "/agent/checkout",
    team: "/agent/team",
  },
};

export const PORTAL_PROPERTY_QUERY_KEY: Record<ListingPortal, string> = {
  landlord: "my-properties-list",
  manager: "manager-properties",
  agency: "agency-properties",
  property_developer: "developer-properties",
  agent: "agent-properties",
};
