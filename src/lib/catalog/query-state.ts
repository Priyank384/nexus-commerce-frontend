import type { CatalogQuery } from "./server";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE_DEPTH = 1000;

/**
 * Values the backend accepts verbatim: `Pagination.of` rejects a field outside its allow-list,
 * and the wire format is `field,direction` — `price:desc` 400s.
 */
export const SORT_OPTIONS = [
  { value: "id,asc", label: "Featured" },
  { value: "price,asc", label: "Price: low to high" },
  { value: "price,desc", label: "Price: high to low" },
  { value: "rating,desc", label: "Top rated" },
  { value: "createdAt,desc", label: "New in" },
  { value: "title,asc", label: "A–Z" },
] as const;

const SORT_VALUES: ReadonlySet<string> = new Set(SORT_OPTIONS.map((o) => o.value));

function clean(value: string | null, lowercase = false): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return lowercase ? trimmed.toLowerCase() : trimmed;
}

function list(values: string[]): string[] {
  const out: string[] = [];
  for (const raw of values) {
    const value = clean(raw, true);
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

function page(value: string | null, fallback: number) {
  const parsed = Number.parseInt(clean(value) ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, MAX_PAGE_DEPTH);
}

function pageSize(value: string | null) {
  const parsed = Number.parseInt(clean(value) ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

/** Read flat, repeated-param URLs (`?sizes=s&m&sizes=l`) into the typed query. */
/**
 * Next hands `searchParams` to a server component as a record whose values may be arrays;
 * `URLSearchParams` rejects a non-string value outright, so repeat keys are flattened here.
 */
export function toUrlSearchParams(
  raw: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value]) out.append(key, entry);
  }
  return out;
}

export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const sizes = list(params.getAll("sizes"));
  const colors = list(params.getAll("colors"));
  return {
    keyword: clean(params.get("keyword")),
    gender: clean(params.get("gender"), true),
    category: clean(params.get("category"), true),
    sizes: sizes.length ? sizes : undefined,
    colors: colors.length ? colors : undefined,
    minPrice: clean(params.get("minPrice")),
    maxPrice: clean(params.get("maxPrice")),
    sort: clean(params.get("sort"), true),
    page: page(params.get("page"), 0),
    size: pageSize(params.get("size")),
  };
}

/** The subset that belongs in the URL — defaults drop out so the first page stays readable. */
export function queryToSearchParams(query: CatalogQuery): URLSearchParams {
  const out = new URLSearchParams();
  if (query.keyword) out.set("keyword", query.keyword);
  if (query.gender) out.set("gender", query.gender);
  if (query.category) out.set("category", query.category);
  for (const size of query.sizes ?? []) out.append("sizes", size);
  for (const color of query.colors ?? []) out.append("colors", color);
  if (query.minPrice) out.set("minPrice", query.minPrice);
  if (query.maxPrice) out.set("maxPrice", query.maxPrice);
  if (query.sort && SORT_VALUES.has(query.sort)) out.set("sort", query.sort);
  // Both are typed as required, but mergeQuery can delete a key, and the output must not
  // depend on that — undefined has to mean the default, not the literal "undefined".
  const size = query.size ?? DEFAULT_PAGE_SIZE;
  if (query.page > 0) out.set("page", String(query.page));
  if (size !== DEFAULT_PAGE_SIZE) out.set("size", String(size));
  return out;
}

/** `null` clears a facet, `undefined` leaves it alone. */
export type QueryPatch = Partial<Record<keyof CatalogQuery, string | number | string[] | null>>;

export function mergeQuery(query: CatalogQuery, patch: QueryPatch): CatalogQuery {
  const next: CatalogQuery = { ...query };
  for (const [key, value] of Object.entries(patch) as [keyof CatalogQuery, unknown][]) {
    if (value === null) delete next[key];
    else (next as Record<string, unknown>)[key] = value;
  }
  // Changing the result set invalidates the page you were on.
  if (!("page" in patch)) next.page = 0;
  return next;
}

/** Toggling a multi-select facet: present means remove, absent means add, order resets. */
export function toggleFacet(query: CatalogQuery, facet: "sizes" | "colors", value: string): CatalogQuery {
  const current = query[facet] ?? [];
  const lower = value.toLowerCase();
  const next = current.includes(lower)
    ? current.filter((entry) => entry !== lower)
    : [...current, lower];
  return mergeQuery(query, { [facet]: next.length ? next : null });
}

export function catalogHref(query: CatalogQuery, patch: QueryPatch = {}, base = "/products"): string {
  const merged = mergeQuery(query, patch);
  const search = queryToSearchParams(merged).toString();
  return search ? `${base}?${search}` : base;
}

/** A price facet is only worth sending when both bounds are numbers and correctly ordered. */
export function isNumericFacet(value: string | undefined): boolean {
  if (!value) return false;
  return /^\d{1,7}(\.\d{1,2})?$/.test(value.trim());
}

export function activeFacetCount(query: CatalogQuery): number {
  let count = 0;
  if (query.keyword) count += 1;
  if (query.gender) count += 1;
  if (query.category) count += 1;
  count += (query.sizes?.length ?? 0) + (query.colors?.length ?? 0);
  if (query.minPrice || query.maxPrice) count += 1;
  return count;
}
