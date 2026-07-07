import staticRoutes from "./staticRoutes.json";

export const SITEMAP_STATIC_PATHS = staticRoutes.sitemapPaths as readonly string[];
export const SERVICE_CATEGORY_SLUGS = staticRoutes.serviceCategories as readonly string[];
export const ROBOTS_DISALLOW_PATHS = staticRoutes.robotsDisallow as readonly string[];

/** All static URL paths included in sitemap.xml (marketing + services index + categories). */
export function allSitemapStaticPaths(): string[] {
  return [...SITEMAP_STATIC_PATHS, ...SERVICE_CATEGORY_SLUGS.map((slug) => `/services/${slug}`)];
}
