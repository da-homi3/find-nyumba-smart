/** Per-category hire tips + FAQs for /services/$category SEO (AEO). */

export type ServiceCategoryContent = {
  hireTips: string[];
  faqs: ReadonlyArray<{ question: string; answer: string }>;
};

const DEFAULT: ServiceCategoryContent = {
  hireTips: [
    "Compare ratings and areas served before requesting a quote.",
    "Prefer providers marked verified — they passed NyumbaSearch checks.",
    "Agree scope and price in writing before work starts.",
  ],
  faqs: [
    {
      question: "How do I hire a home service provider on NyumbaSearch?",
      answer:
        "Open the category page, filter by county if needed, compare ratings, then request a quote or contact the provider in-app.",
    },
    {
      question: "Are NyumbaSearch service providers verified?",
      answer:
        "Verified providers completed NyumbaSearch identity and category checks. Always confirm scope and pricing before work begins.",
    },
  ],
};

const BY_CATEGORY: Record<string, ServiceCategoryContent> = {
  electricians: {
    hireTips: [
      "Ask for EPRA or county licensing where the job involves wiring or meters.",
      "Confirm whether materials are included or billed separately.",
      "For faults, request a diagnosis fee upfront so you are not surprised later.",
    ],
    faqs: [
      {
        question: "How much do electricians charge in Kenya?",
        answer:
          "Call-out and labour rates vary by county and job size. Use NyumbaSearch to request quotes from verified electricians near you and compare before booking.",
      },
      {
        question: "Should I hire a licensed electrician?",
        answer:
          "Yes for wiring, consumer units, and meter work. Prefer verified providers and ask for proof of licensing before work starts.",
      },
    ],
  },
  plumbers: {
    hireTips: [
      "Describe the symptom (leak, blockage, geyser) so quotes stay comparable.",
      "Ask whether pipe materials and fittings are included.",
      "For emergencies, confirm same-day availability and after-hours rates.",
    ],
    faqs: [
      {
        question: "How do I find a plumber near me in Kenya?",
        answer:
          "Browse plumbers on NyumbaSearch, filter by county, then request a quote from rated providers serving your area.",
      },
      {
        question: "What should I ask before hiring a plumber?",
        answer:
          "Confirm availability, whether parts are included, warranty on workmanship, and that the quote covers the full repair — not only a visit fee.",
      },
    ],
  },
  movers: {
    hireTips: [
      "Share inventory size (bedsitter vs 3-bedroom) for accurate van quotes.",
      "Ask about packing, stairs, and long-carry surcharges.",
      "Confirm insurance coverage for breakage before the move day.",
    ],
    faqs: [
      {
        question: "How much do movers cost in Nairobi?",
        answer:
          "Prices depend on distance, volume, and stairs. Use the movers estimator on NyumbaSearch and request quotes from verified relocation teams.",
      },
      {
        question: "When should I book movers?",
        answer:
          "Book several days ahead for weekends and month-end. Share your inventory list early so the team sends the right vehicle.",
      },
    ],
  },
  cleaning: {
    hireTips: [
      "Specify rooms, bathrooms, and deep-clean vs standard tidy-up.",
      "Ask if supplies and equipment are included.",
      "For move-out cleans, request a checklist tied to your landlord’s inspection.",
    ],
    faqs: [
      {
        question: "How do I book house cleaning in Kenya?",
        answer:
          "Open Cleaning services on NyumbaSearch, pick your county, compare ratings, and request a quote with your property size and preferred date.",
      },
      {
        question: "Do cleaners bring their own supplies?",
        answer:
          "It varies by provider. Confirm supplies, chemicals, and equipment in the quote so there are no surprises on the day.",
      },
    ],
  },
  internet: {
    hireTips: [
      "Check which ISPs already cover your building or estate.",
      "Ask about router ownership vs rental and contract length.",
      "Confirm installation lead times before you move in.",
    ],
    faqs: [
      {
        question: "How do I get fibre internet installed in Nairobi?",
        answer:
          "Browse Internet installation providers on NyumbaSearch, filter by county, and request quotes that include installation fees and package speeds.",
      },
    ],
  },
  security: {
    hireTips: [
      "Clarify CCTV, alarms, electric fence, or guard services in the brief.",
      "Ask about maintenance visits and spare-parts availability.",
      "For estates, confirm management approval before installing shared equipment.",
    ],
    faqs: [
      {
        question: "How do I hire a security systems installer in Kenya?",
        answer:
          "Use NyumbaSearch Security systems providers, compare ratings and areas served, then request a site survey quote before buying equipment.",
      },
    ],
  },
  solar: {
    hireTips: [
      "Share average monthly kWh usage or your electricity bill for sizing.",
      "Ask for inverter brand, panel warranty, and after-sales support.",
      "Confirm whether mounting and EPRA paperwork are included.",
    ],
    faqs: [
      {
        question: "How do I choose a solar installer in Kenya?",
        answer:
          "Compare verified solar providers on NyumbaSearch, request system-size quotes, and check warranties before paying a deposit.",
      },
    ],
  },
  pest_control: {
    hireTips: [
      "Name the pest (cockroaches, rodents, bedbugs, termites) for the right treatment.",
      "Ask about re-treatment guarantees and safe re-entry times.",
      "Prepare the home (cover food, move furniture) as the provider advises.",
    ],
    faqs: [
      {
        question: "How much is fumigation in Kenya?",
        answer:
          "Rates depend on property size and pest type. Request quotes from NyumbaSearch pest control providers serving your county.",
      },
    ],
  },
};

export function getServiceCategoryContent(categoryId: string): ServiceCategoryContent {
  return BY_CATEGORY[categoryId] ?? DEFAULT;
}
