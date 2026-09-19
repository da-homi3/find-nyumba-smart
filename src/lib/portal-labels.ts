export function portalLabelForRole(
  role: "landlord" | "agency" | "manager" | "property_developer" | "agent",
): string {
  if (role === "agency") return "Agency";
  if (role === "manager") return "Property manager";
  if (role === "property_developer") return "Property developer";
  if (role === "agent") return "Agent";
  return "Landlord";
}
