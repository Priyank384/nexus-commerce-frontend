import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getCategoryTree, searchProducts, toFacetRoots } from "@/lib/catalog/server";
import { absoluteUrl } from "@/lib/site";

/**
 * Rendered per request: the catalogue lives in the backend, which is not available when the
 * frontend is built. `connection()` marks that dependency so the build never calls out; the
 * product reads themselves are cached, so a crawler hitting this costs one upstream pass.
 * An outage must not take the sitemap down with it — the static routes still ship.
 */
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/products"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  await connection();

  try {
    const tree = await getCategoryTree();
    const departments = toFacetRoots(tree).flatMap((root) => [root.slug, ...root.children.map((child) => child.slug)]);

    const products: MetadataRoute.Sitemap = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const results = await searchProducts({ page, size: PAGE_SIZE });
      for (const product of results.content) {
        if (!product.slug) continue;
        products.push({
          url: absoluteUrl(`/products/${product.slug}`),
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
      if (results.last || page + 1 >= results.totalPages) break;
    }

    return [
      ...staticRoutes,
      ...departments.map((slug) => ({
        url: absoluteUrl(`/products?category=${encodeURIComponent(slug)}`),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
      ...products,
    ];
  } catch {
    return staticRoutes;
  }
}
