export function portalLabelForRole(role: "landlord" | "agency" | "manager"): string {
  if (role === "agency") return "Agency";
  if (role === "manager") return "Property manager";
  return "Landlord";
}
