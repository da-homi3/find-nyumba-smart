import { formatKes, prettyType, type Property } from "@/lib/properties";
import { getSiteUrl } from "@/lib/site";
import { NAIROBI_GEO } from "@/lib/seo/faq";

export function buildPropertyDetailHead(p: Property | undefined) {
  if (!p) {
    return {
      meta: [
        { title: "Property not found — NyumbaSearch" },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  }
  const title = `${p.title} — ${p.neighborhood}, Nairobi | NyumbaSearch`;
  const description =
    p.description?.slice(0, 160) ??
    `${prettyType(p.property_type)} in ${p.neighborhood}, Nairobi from ${formatKes(p.rent_kes)}/mo. Verified listing on NyumbaSearch.`;
  const canonical = `${getSiteUrl()}/tenant/property/${p.id}`;
  const ogImage = p.images[0] ?? `${getSiteUrl()}/og-image.jpg`;
  const lat = p.latitude ?? undefined;
  const lng = p.longitude ?? undefined;
  const vacant = p.is_vacant !== false;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["Apartment", "Product"],
    name: p.title,
    description,
    url: canonical,
    address: {
      "@type": "PostalAddress",
      addressLocality: p.neighborhood,
      addressRegion: "Nairobi",
      addressCountry: "KE",
    },
    geo:
      lat != null && lng != null
        ? { "@type": "GeoCoordinates", latitude: lat, longitude: lng }
        : undefined,
    offers: {
      "@type": "Offer",
      price: p.rent_kes,
      priceCurrency: "KES",
      priceSpecification: { "@type": "UnitPriceSpecification", price: p.rent_kes, priceCurrency: "KES", unitText: "Month" },
      availability: vacant ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      areaServed: { "@type": "City", name: "Nairobi" },
    },
    numberOfRooms: p.bedrooms,
    numberOfBathroomsTotal: p.bathrooms,
    floorSize: p.area_sqm ? { "@type": "QuantitativeValue", value: p.area_sqm, unitCode: "MTK" } : undefined,
    image: p.images.length > 0 ? p.images : undefined,
  };
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { name: "geo.region", content: NAIROBI_GEO.region },
      { name: "geo.placename", content: `${p.neighborhood}, Nairobi, Kenya` },
      ...(lat != null && lng != null
        ? [
            { name: "geo.position", content: `${lat};${lng}` },
            { name: "ICBM", content: `${lat}, ${lng}` },
          ]
        : []),
      { property: "og:locale", content: NAIROBI_GEO.locale },
      { property: "og:site_name", content: "NyumbaSearch" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      { property: "og:image", content: ogImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: ogImage },
    ],
    links: [
      { rel: "canonical", href: canonical },
      { rel: "alternate", hrefLang: "en-KE", href: canonical },
      { rel: "alternate", hrefLang: "x-default", href: canonical },
    ],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
  };
}
