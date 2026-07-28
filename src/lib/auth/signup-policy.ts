import type { AccountRole } from "@/lib/account-roles";

export const SIGNUP_POLICY_VERSION = "2026-07-28";

export type SignupPolicySection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type SignupPolicyContent = {
  role: AccountRole;
  title: string;
  intro: string;
  acceptLabel: string;
  sections: SignupPolicySection[];
};

function baseSections(roleLabel: string): SignupPolicySection[] {
  return [
    {
      title: "How NyumbaSearch works",
      paragraphs: [
        "NyumbaSearch is a Kenyan property marketplace and property operations platform. We help users discover listings, contact property advertisers, manage portfolios, receive alerts, and complete selected payments inside the app.",
        `Your ${roleLabel} account gives you access only to the features that match that role. Some features may change, expand, or be retired as the product evolves.`,
      ],
    },
    {
      title: "Eligibility and account security",
      bullets: [
        "You must provide accurate name, phone, email, and business or portfolio details where requested.",
        "You are responsible for activity under your account, including actions taken by your team members, caretakers, or invited staff.",
        "You must keep your password, OTPs, and payment approvals secure and notify NyumbaSearch promptly if you suspect unauthorized access.",
      ],
    },
    {
      title: "Payments, subscriptions, and communications",
      bullets: [
        "Some features require paid plans, listing boosts, verification, contact unlocks, or other paid services billed in Kenya shillings unless stated otherwise.",
        "By signing up, you agree to receive essential service messages such as verification notices, approvals, payments, listing alerts, safety notices, and account updates.",
        "Fees already used for delivered digital services, fulfilled boosts, or completed verifications may be non-refundable unless required by law or an explicit product policy.",
      ],
    },
    {
      title: "Platform rules",
      bullets: [
        "Do not upload false, misleading, infringing, discriminatory, unsafe, or illegal content.",
        "Do not bypass verification, scrape the platform, abuse leads, send spam, or use the service to misrepresent ownership, authority, or property condition.",
        "NyumbaSearch may suspend listings, remove content, freeze features, or close accounts where fraud, abuse, non-payment, policy breach, or legal risk is suspected.",
      ],
    },
    {
      title: "Disclaimers and liability",
      paragraphs: [
        "NyumbaSearch works to improve trust through verification, moderation, fraud checks, and risk signals, but we do not guarantee that every user, listing, property condition, payment, or off-platform transaction will be error-free or risk-free.",
        "Users remain responsible for their own decisions, due diligence, contracts, inspections, compliance duties, and local legal obligations. To the extent allowed by law, NyumbaSearch is not liable for indirect, incidental, or consequential losses arising from platform use.",
      ],
    },
  ];
}

export function signupPolicyForRole(role: AccountRole): SignupPolicyContent {
  if (role === "landlord") {
    return {
      role,
      title: "Landlord Account Terms and Conditions",
      intro:
        "These terms apply when you create a landlord account on NyumbaSearch to advertise, manage, promote, or monetize residential or commercial property inventory.",
      acceptLabel: "I accept the landlord account terms and conditions",
      sections: [
        {
          title: "Landlord features and responsibilities",
          bullets: [
            "You may create listings, upload photos and pricing, respond to leads, manage inquiries, track performance, and purchase landlord or PM-related upgrades available to your account.",
            "You confirm that you own the property, control it, or are lawfully authorized to advertise and manage it on behalf of the owner.",
            "You must keep pricing, availability, amenities, house rules, and contact details current and remove listings that are no longer available or lawfully marketable.",
          ],
        },
        {
          title: "Lead handling and fair dealing",
          bullets: [
            "You must respond to tenant inquiries honestly and without harassment, coercion, hidden fees, or discriminatory screening.",
            "You may not use tenant contact details for unrelated marketing, resale, or spam.",
            "You are responsible for tenancy documents, deposits, receipts, tax compliance, safety compliance, and any landlord-tenant obligations outside the app.",
          ],
        },
        ...baseSections("landlord"),
      ],
    };
  }

  if (role === "manager") {
    return {
      role,
      title: "Property Manager Account Terms and Conditions",
      intro:
        "These terms apply when you create a property manager account on NyumbaSearch to manage properties, teams, rent workflows, tenant operations, and portfolio performance for yourself or third-party owners.",
      acceptLabel: "I accept the property manager account terms and conditions",
      sections: [
        {
          title: "Manager features and responsibilities",
          bullets: [
            "Your account may include portfolio dashboards, team tools, rent tracking, maintenance coordination, communication tools, reporting, and payouts or payment collection workflows where enabled.",
            "You confirm that you hold valid management authority for each property, unit, listing, or tenant record you add to the platform.",
            "You are responsible for staff access, invited users, assigned roles, property data quality, payout destination accuracy, and approval of actions taken in your organization.",
          ],
        },
        {
          title: "Operational and money movement rules",
          bullets: [
            "Where rent reminders, ledgers, payout batches, or payment fulfillment tools are available, they are operational tools and do not replace your own accounting, trust-account, reconciliation, tax, audit, or legal duties.",
            "You must verify owner instructions, bank or payout details, and property-level permissions before initiating or approving money movement.",
            "NyumbaSearch may delay, review, or reject operational payouts, integrations, or account changes where fraud, mismatch, sanctions, chargeback, or compliance concerns appear.",
          ],
        },
        ...baseSections("property manager"),
      ],
    };
  }

  if (role === "agency") {
    return {
      role,
      title: "Real Estate Agency Account Terms and Conditions",
      intro:
        "These terms apply when you create a real estate agency account on NyumbaSearch to market property inventory, manage agents, collaborate as a team, and generate leads through the platform.",
      acceptLabel: "I accept the real estate agency account terms and conditions",
      sections: [
        {
          title: "Agency features and responsibilities",
          bullets: [
            "Agency accounts may access team management, shared listings, portfolio pages, performance insights, lead routing, bulk workflows, and other agency tools offered by NyumbaSearch.",
            "You confirm that your agency and its team members are authorized to market each property posted under the agency account.",
            "You are responsible for supervising agents, protecting client data, and making sure your listings and representations are lawful, accurate, and current.",
          ],
        },
        {
          title: "Lead quality, team use, and branding",
          bullets: [
            "You may not create duplicate, misleading, bait, or stolen listings to dominate search results or divert tenants.",
            "You may not impersonate another agency, agent, landlord, or developer, or misuse NyumbaSearch branding, badges, or verification marks.",
            "Team invites, shared dashboards, and agent activity remain your responsibility, and NyumbaSearch may audit or restrict abusive agency behavior.",
          ],
        },
        ...baseSections("agency"),
      ],
    };
  }

  return {
    role,
    title: "Tenant Account Terms and Conditions",
    intro:
      "These terms apply when you create a tenant account on NyumbaSearch to browse homes, save listings, contact advertisers, receive alerts, and use tenant-side services such as verifications or paid contact unlocks.",
    acceptLabel: "I accept the tenant account terms and conditions",
    sections: [
      {
        title: "Tenant features and responsibilities",
        bullets: [
          "Your account may let you browse listings, save homes, compare properties, receive alerts, pay for optional services, and message landlords, managers, or agencies through the app.",
          "You should verify house rules, location, rent terms, utilities, deposits, and move-in details before making commitments or payments.",
          "You must not misuse advertiser phone numbers, send spam, harass property contacts, or use the platform to impersonate another person or submit false inquiries.",
        ],
      },
      {
        title: "Search, alerts, and optional paid tools",
        bullets: [
          "Search results, alerts, verification signals, and scam-risk indicators are informational tools that help you evaluate listings but do not replace your own due diligence.",
          "Optional paid features such as contact unlocks, reports, or subscriptions are digital services delivered through the app and may have feature-specific rules or billing terms.",
          "You remain responsible for off-platform negotiations, viewing decisions, deposits, lease agreements, and any payments you make directly to a property advertiser.",
        ],
      },
      ...baseSections("tenant"),
    ],
  };
}
