import {
  CUSTOMER_CARE_EMAIL,
  CUSTOMER_CARE_PHONE_E164,
  getBrandLogoUrl,
  getSiteUrl,
  HOMEPAGE_DESCRIPTION,
} from "@/lib/site";

/** Brand strings Google should map to the official site for queries like "nyumbasearch". */
export const BRAND_NAME = "NyumbaSearch";
export const BRAND_ALTERNATE_NAMES = [
  "nyumbasearch",
  "Nyumba Search",
  "nyumbasearch.com",
  "NyumbaSearch Kenya",
] as const;

/**
 * Homepage JSON-LD graph: WebSite + Organization + RealEstateAgent.
 * alternateName helps brand queries resolve to https://nyumbasearch.com.
 */
export function buildHomepageJsonLd() {
  const site = getSiteUrl();
  const logoUrl = getBrandLogoUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        name: BRAND_NAME,
        alternateName: [...BRAND_ALTERNATE_NAMES],
        url: site,
        description: HOMEPAGE_DESCRIPTION,
        inLanguage: "en-KE",
        publisher: { "@id": `${site}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${site}/tenant?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${site}/#organization`,
        name: BRAND_NAME,
        legalName: "NyumbaSearch",
        alternateName: [...BRAND_ALTERNATE_NAMES],
        url: site,
        description: HOMEPAGE_DESCRIPTION,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
          width: 512,
          height: 512,
        },
        image: logoUrl,
        email: CUSTOMER_CARE_EMAIL,
        telephone: CUSTOMER_CARE_PHONE_E164,
        areaServed: {
          "@type": "Country",
          name: "Kenya",
        },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          email: CUSTOMER_CARE_EMAIL,
          telephone: CUSTOMER_CARE_PHONE_E164,
          areaServed: "KE",
          availableLanguage: ["en", "sw"],
        },
      },
      {
        "@type": "RealEstateAgent",
        "@id": `${site}/#realestate`,
        name: BRAND_NAME,
        alternateName: [...BRAND_ALTERNATE_NAMES],
        url: site,
        description: HOMEPAGE_DESCRIPTION,
        areaServed: "Nairobi, Kenya",
        parentOrganization: { "@id": `${site}/#organization` },
      },
    ],
  };
}
