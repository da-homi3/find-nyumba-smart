/** Maps portal sidebar paths to onboarding spotlight selectors. */
export const PORTAL_NAV_TOUR_ATTR: Record<string, string> = {
  "/landlord/dashboard": "portal-nav-dashboard",
  "/manager/dashboard": "portal-nav-dashboard",
  "/agency/dashboard": "portal-nav-dashboard",
  "/landlord/properties": "portal-nav-properties",
  "/manager/properties": "portal-nav-properties",
  "/agency/properties": "portal-nav-properties",
  "/landlord/leads": "portal-nav-leads",
  "/manager/leads": "portal-nav-leads",
  "/agency/leads": "portal-nav-leads",
  "/landlord/dashboard/plan": "portal-nav-plan",
  "/manager/dashboard/plan": "portal-nav-plan",
  "/agency/dashboard/plan": "portal-nav-plan",
  "/manager/team": "portal-nav-team",
  "/agency/team": "portal-nav-team",
};

export function portalNavTourAttr(path: string): string | undefined {
  return PORTAL_NAV_TOUR_ATTR[path];
}
