export type TenantScoreRule = {
  id: string;
  name: string;
  description: string;
  points: number;
  category: "verified" | "complete";
  tenantVisibility: boolean;
  enabled: boolean;
};

/** Profile completeness only — never a credit, risk, or eligibility score. */
export const TENANT_SCORE_RULES: TenantScoreRule[] = [
  { id: "phone", name: "Phone verified", description: "Approved phone verification", points: 10, category: "verified", tenantVisibility: true, enabled: true },
  { id: "email", name: "Email verified", description: "Confirmed email on the account", points: 10, category: "verified", tenantVisibility: true, enabled: true },
  { id: "identity", name: "Identity verified", description: "Approved identity verification", points: 20, category: "verified", tenantVisibility: true, enabled: true },
  { id: "employment", name: "Employment verified", description: "Approved employment verification", points: 15, category: "verified", tenantVisibility: true, enabled: true },
  { id: "income", name: "Income verified", description: "Approved income verification where offered", points: 15, category: "verified", tenantVisibility: true, enabled: true },
  { id: "tenancy", name: "Previous tenancy", description: "Previous tenancy notes provided", points: 10, category: "complete", tenantVisibility: true, enabled: true },
  { id: "locations", name: "Preferred locations", description: "At least one preferred area", points: 5, category: "complete", tenantVisibility: true, enabled: true },
  { id: "budget", name: "Budget confirmed", description: "Budget range saved", points: 5, category: "complete", tenantVisibility: true, enabled: true },
  { id: "move_in", name: "Move-in date", description: "Target move-in date saved", points: 5, category: "complete", tenantVisibility: true, enabled: true },
  { id: "profile", name: "Profile completed", description: "Name and phone on profile", points: 5, category: "complete", tenantVisibility: true, enabled: true },
];

export type TenantScoreEvidence = {
  phoneVerified: boolean;
  emailVerified: boolean;
  identityVerified: boolean;
  employmentVerified: boolean;
  incomeVerified: boolean;
  tenancyProvided: boolean;
  hasLocations: boolean;
  hasBudget: boolean;
  hasMoveIn: boolean;
  profileComplete: boolean;
};

export type TenantScoreResult = {
  percent: number;
  totalPoints: number;
  maxPoints: number;
  awarded: Array<{ id: string; name: string; points: number; category: "verified" | "complete" }>;
  missing: Array<{ id: string; name: string; points: number; action: string }>;
  disclaimer: string;
};

const ACTIONS: Record<string, string> = {
  phone: "Verify your phone",
  email: "Confirm your email",
  identity: "Submit ID verification",
  employment: "Submit employment verification",
  income: "Submit income verification when available",
  tenancy: "Add previous tenancy information",
  locations: "Add preferred locations",
  budget: "Add your budget",
  move_in: "Add a move-in date",
  profile: "Add your name and phone",
};

export function computeTenantScore(
  evidence: TenantScoreEvidence,
  rules: TenantScoreRule[] = TENANT_SCORE_RULES,
): TenantScoreResult {
  const enabled = rules.filter((r) => r.tenantVisibility && r.enabled !== false);
  const maxPoints = enabled.reduce((sum, r) => sum + r.points, 0);
  const awarded: TenantScoreResult["awarded"] = [];
  const missing: TenantScoreResult["missing"] = [];

  const hit: Record<string, boolean> = {
    phone: evidence.phoneVerified,
    email: evidence.emailVerified,
    identity: evidence.identityVerified,
    employment: evidence.employmentVerified,
    income: evidence.incomeVerified,
    tenancy: evidence.tenancyProvided,
    locations: evidence.hasLocations,
    budget: evidence.hasBudget,
    move_in: evidence.hasMoveIn,
    profile: evidence.profileComplete,
  };

  for (const rule of enabled) {
    if (hit[rule.id]) {
      awarded.push({ id: rule.id, name: rule.name, points: rule.points, category: rule.category });
    } else {
      missing.push({
        id: rule.id,
        name: rule.name,
        points: rule.points,
        action: ACTIONS[rule.id] ?? `Complete ${rule.name.toLowerCase()}`,
      });
    }
  }

  const totalPoints = awarded.reduce((sum, r) => sum + r.points, 0);
  const percent = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
  return {
    percent,
    totalPoints,
    maxPoints,
    awarded,
    missing,
    disclaimer:
      "This is a NyumbaSearch profile completeness score. It is not a credit score, risk score, or a decision about whether you can rent.",
  };
}
