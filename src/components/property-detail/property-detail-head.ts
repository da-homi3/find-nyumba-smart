import { formatKes, prettyType, type Property } from "@/lib/properties";

export function buildPropertyDetailHead(p: Property | undefined) {
  if (!p) {
    return { meta: [{ title: "Property — NyumbaSearch" }] };
  }
  const title = `${p.title} — ${p.neighborhood} | NyumbaSearch`;
  const description =
    p.description?.slice(0, 160) ??
    `${prettyType(p.property_type)} in ${p.neighborhood} from ${formatKes(p.rent_kes)}/mo`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Apartment",
    name: p.title,
    description,
    address: { "@type": "PostalAddress", addressLocality: p.neighborhood, addressCountry: "KE" },
    geo:
      p.latitude && p.longitude
        ? { "@type": "GeoCoordinates", latitude: p.latitude, longitude: p.longitude }
        : undefined,
    offers: {
      "@type": "Offer",
      price: p.rent_kes,
      priceCurrency: "KES",
      availability: "https://schema.org/InStock",
    },
    image: p.images[0],
  };
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      ...(p.images[0] ? [{ property: "og:image", content: p.images[0] }] : []),
    ],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
  };
}
