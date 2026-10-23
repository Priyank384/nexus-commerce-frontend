import { backendUrl } from "@/lib/api/backend";
import type { components } from "@/lib/api/schema";

export type ProductListItem = components["schemas"]["GetProductWithDetailsResponseDto"];
export type ProductVariant = components["schemas"]["GetVariantResponseDto"];
/**
 * `GET /api/v1/categories/tree` sends `children`, but the generated contract drops it: springdoc
 * prunes a self-referential property from its own schema. Until the backend documents it, the
 * tree needs a hand-written node type — the generated one is quietly incomplete here.
 */
export type CategoryNode = {
  id?: number;
  name?: string;
  slug?: string;
  description?: string;
  parentId?: number;
  children?: CategoryNode[];
};
export type ProductImage = components["schemas"]["GetProductImageResponseDto"];
/** The backend echoes the requested page back as `page`, not Spring's `number`. */
export type PageMeta = {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

export type ProductPage = PageMeta & { content: ProductListItem[] };

type Envelope<T> = { success: boolean; message: string; error: string | null; data: T };

/** Carries the upstream status so a page can tell "no such product" from "backend is down". */
export class CatalogError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CatalogError";
    this.status = status;
  }
}

/** Facet/filter state as it appears in the URL, before it is turned into query params. */
export type CatalogQuery = {
  keyword?: string;
  gender?: string;
  category?: string;
  sizes?: string[];
  colors?: string[];
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page: number;
  size: number;
};

/**
 * Server-side reads for the catalogue. The browser client in ../api/client.ts points at the
 * BFF because it has no backend origin; a server component does, so it goes straight to Spring
 * and skips a hop. Public endpoints only — anything carrying a bearer belongs in a client.
 */
async function read<T>(path: string, query?: URLSearchParams): Promise<T> {
  const url = new URL(path, backendUrl());
  if (query && query.toString()) url.search = query.toString();
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body?.success) {
    throw new CatalogError(
      body?.error || body?.message || `Catalogue request failed (${res.status})`,
      res.status,
    );
  }
  return body.data;
}

export function apply(query: URLSearchParams, params: CatalogQuery) {
  if (params.keyword) query.set("keyword", params.keyword);
  if (params.gender) query.set("gender", params.gender);
  if (params.category) query.set("categorySlug", params.category);
  for (const size of params.sizes ?? []) query.append("sizes", size);
  for (const color of params.colors ?? []) query.append("colors", color);
  if (params.minPrice) query.set("minPrice", params.minPrice);
  if (params.maxPrice) query.set("maxPrice", params.maxPrice);
  if (params.sort) query.set("sort", params.sort);
  query.set("page", String(params.page));
  query.set("size", String(params.size));
  return query;
}

export function searchProducts(params: CatalogQuery) {
  return read<ProductPage>("/api/v1/products/search", apply(new URLSearchParams(), params));
}

/** A page of products from the same facet combination, minus the ones we already showed. */
export function searchProductsSlice(params: CatalogQuery, size: number, page = 0) {
  return searchProducts({ ...params, size, page });
}

export function getProductBySlug(slug: string) {
  return read<ProductListItem>(`/api/v1/products/slug/${encodeURIComponent(slug)}`);
}

export function getCategoryTree() {
  return read<CategoryNode[]>("/api/v1/categories/tree");
}

export function getFacetSizes() {
  return read<string[]>("/api/v1/products/facets/sizes");
}

export function getFacetColors() {
  return read<string[]>("/api/v1/products/facets/colors");
}

/** A category the nav can link to. `slug` is the only key the search endpoint accepts. */
export type FacetRoot = { slug: string; name: string; children: { slug: string; name: string }[] };

/** Narrow the loosely-typed tree down to the rows a filter panel can actually link to. */
export function toFacetRoots(nodes: CategoryNode[]): FacetRoot[] {
  const linkable = (node: CategoryNode) =>
    node.slug && node.name ? { slug: node.slug, name: node.name } : null;
  return nodes.flatMap((node) => {
    const self = linkable(node);
    if (!self) return [];
    const children = (node.children ?? [])
      .map(linkable)
      .filter((child): child is { slug: string; name: string } => child !== null);
    return children.length ? [{ ...self, children }] : [];
  });
}
