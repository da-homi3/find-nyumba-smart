import staticRoutes from "./staticRoutes.json";

export const SITEMAP_STATIC_PATHS = staticRoutes.sitemapPaths as readonly string[];
export const SERVICE_CATEGORY_SLUGS = staticRoutes.serviceCategories as readonly string[];
export const ROBOTS_DISALLOW_PATHS = staticRoutes.robotsDisallow as readonly string[];
export const AI_USER_AGENTS = staticRoutes.aiUserAgents as readonly string[];

/** All static URL paths included in sitemap.xml (marketing + Nairobi areas + services). */
export function allSitemapStaticPaths(): string[] {
  const geoAreas = staticRoutes.geoAreas as ReadonlyArray<{ slug: string }>;
  const marketing = SITEMAP_STATIC_PATHS.filter(
    (path) => path !== "/areas" && !path.startsWith("/areas/"),
  );
  const areas = ["/areas", ...geoAreas.map((area) => `/areas/${area.slug}`)];
  const services = SERVICE_CATEGORY_SLUGS.map((slug) => `/services/${slug}`);
  return [...marketing, ...areas, ...services];
}
