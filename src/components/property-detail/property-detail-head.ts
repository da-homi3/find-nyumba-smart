import { formatKes, prettyType, type Property } from "@/lib/properties";
import { getSiteUrl } from "@/lib/site";

export function buildPropertyDetailHead(p: Property | undefined) {
  if (!p) {
    return { meta: [{ title: "Property — NyumbaSearch" }] };
  }
  const title = `${p.title} — ${p.neighborhood} | NyumbaSearch`;
  const description =
    p.description?.slice(0, 160) ??
    `${prettyType(p.property_type)} in ${p.neighborhood} from ${formatKes(p.rent_kes)}/mo`;
  const canonical = `${getSiteUrl()}/tenant/property/${p.id}`;
  const ogImage = p.images[0] ?? `${getSiteUrl()}/og-image.jpg`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: p.title,
    description,
    url: canonical,
    address: { "@type": "PostalAddress", addressLocality: p.neighborhood, addressCountry: "KE" },
    geo:
      p.latitude && p.longitude
        ? { "@type": "GeoCoordinates", latitude: p.latitude, longitude: p.longitude }
        : undefined,
    offers: {
      "@type": "Offer",
      price: p.rent_kes,
      priceCurrency: "KES",
      priceSpecification: { "@type": "UnitPriceSpecification", unitText: "Month" },
      availability: "https://schema.org/InStock",
    },
    numberOfRooms: p.bedrooms,
    image: p.images.length > 0 ? p.images : undefined,
  };
  return {
    meta: [
      { title },
      { name: "description", content: description },
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
    links: [{ rel: "canonical", href: canonical }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
  };
}
