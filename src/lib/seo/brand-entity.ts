import {
  CUSTOMER_CARE_EMAIL,
  CUSTOMER_CARE_PHONE_E164,
  getBrandLogoUrl,
  getSiteUrl,
  HOMEPAGE_DESCRIPTION,
} from "@/lib/site";
import { NAIROBI_GEO, NYUMBASEARCH_FAQS } from "@/lib/seo/faq";

/** Brand strings Google should map to the official site for queries like "nyumbasearch". */
export const BRAND_NAME = "NyumbaSearch";
export const BRAND_ALTERNATE_NAMES = [
  "nyumbasearch",
  "Nyumba Search",
  "nyumbasearch.com",
  "NyumbaSearch Kenya",
] as const;

function nairobiPlace() {
  return {
    "@type": "PostalAddress",
    streetAddress: "Nairobi",
    addressLocality: "Nairobi",
    addressRegion: "Nairobi County",
    postalCode: "00100",
    addressCountry: NAIROBI_GEO.country,
  };
}

/**
 * Homepage JSON-LD graph: WebSite + Organization + RealEstateAgent + FAQ.
 * alternateName helps brand queries resolve to https://nyumbasearch.com.
 */
export function buildHomepageJsonLd() {
  const site = getSiteUrl();
  const logoUrl = getBrandLogoUrl();
  const geo = {
    "@type": "GeoCoordinates",
    latitude: NAIROBI_GEO.latitude,
    longitude: NAIROBI_GEO.longitude,
  };

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
        inLanguage: NAIROBI_GEO.language,
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
        "@type": ["Organization", "OnlineBusiness"],
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
        address: nairobiPlace(),
        geo,
        areaServed: [
          { "@type": "City", name: "Nairobi" },
          { "@type": "Country", name: "Kenya" },
        ],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          email: CUSTOMER_CARE_EMAIL,
          telephone: CUSTOMER_CARE_PHONE_E164,
          areaServed: "KE",
          availableLanguage: ["en", "sw"],
        },
        knowsAbout: [
          "Nairobi rentals",
          "Kenya apartments",
          "verified landlords",
          "home services Kenya",
        ],
      },
      {
        "@type": "RealEstateAgent",
        "@id": `${site}/#realestate`,
        name: BRAND_NAME,
        alternateName: [...BRAND_ALTERNATE_NAMES],
        url: site,
        description: HOMEPAGE_DESCRIPTION,
        address: nairobiPlace(),
        geo,
        areaServed: {
          "@type": "City",
          name: "Nairobi",
          containedInPlace: { "@type": "Country", name: "Kenya" },
        },
        parentOrganization: { "@id": `${site}/#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${site}/#faq`,
        mainEntity: NYUMBASEARCH_FAQS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}
