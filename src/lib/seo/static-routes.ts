import staticRoutes from "./staticRoutes.json";
import { HOMEPAGE_PROPERTY_CATEGORIES } from "@/lib/landing/homepage-categories";

export const SITEMAP_STATIC_PATHS = staticRoutes.sitemapPaths as readonly string[];
export const SERVICE_CATEGORY_SLUGS = staticRoutes.serviceCategories as readonly string[];
export const ROBOTS_DISALLOW_PATHS = staticRoutes.robotsDisallow as readonly string[];
export const AI_USER_AGENTS = staticRoutes.aiUserAgents as readonly string[];

/** All static URL paths included in sitemap.xml (marketing + Nairobi areas + services + categories). */
export function allSitemapStaticPaths(): string[] {
  const geoAreas = staticRoutes.geoAreas as ReadonlyArray<{ slug: string }>;
  const marketing = SITEMAP_STATIC_PATHS.filter(
    (path) => path !== "/areas" && !path.startsWith("/areas/"),
  );
  const areas = ["/areas", ...geoAreas.map((area) => `/areas/${area.slug}`)];
  const services = SERVICE_CATEGORY_SLUGS.map((slug) => `/services/${slug}`);
  const categories = HOMEPAGE_PROPERTY_CATEGORIES.map((c) => `/categories/${c.id}`);
  const guides = ["/guides", ...geoAreas.map((area) => `/guides/${area.slug}`)];
  return [...marketing, ...areas, ...services, ...categories, ...guides];
}
