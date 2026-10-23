import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  activeFacetCount,
  catalogHref,
  mergeQuery,
  parseCatalogQuery,
  queryToSearchParams,
  toUrlSearchParams,
  toggleFacet,
} from "./query-state";
import type { CatalogQuery } from "./server";

const empty: CatalogQuery = { page: 0, size: DEFAULT_PAGE_SIZE };

function parse(url: string) {
  return parseCatalogQuery(new URLSearchParams(url.split("?")[1] ?? ""));
}

describe("parseCatalogQuery", () => {
  it("keeps only the defaults when the URL is bare", () => {
    expect(parse("/products")).toEqual(empty);
  });

  it("lowercases facets and drops blanks", () => {
    const query = parse("/products?gender= MEN &category= Mens-Denim &sizes=&sizes=L");
    expect(query.gender).toBe("men");
    expect(query.category).toBe("mens-denim");
    expect(query.sizes).toEqual(["l"]);
  });

  it("collects repeated facet values without duplicates", () => {
    expect(parse("/products?sizes=m&sizes=M&sizes=l").sizes).toEqual(["m", "l"]);
  });

  it("clamps page and size the way the backend does", () => {
    expect(parse("/products?page=-3&size=5000").page).toBe(0);
    expect(parse("/products?size=5000").size).toBe(MAX_PAGE_SIZE);
    expect(parse("/products?page=abc").page).toBe(0);
  });

  it("keeps the keyword as typed apart from trimming", () => {
    expect(parse("/products?keyword=%20Selvedge%20Jean%20").keyword).toBe("Selvedge Jean");
  });
});

describe("queryToSearchParams", () => {
  it("omits the page and size a first visit would carry anyway", () => {
    expect(queryToSearchParams(empty).toString()).toBe("");
  });

  it("drops a sort the backend would reject", () => {
    // Pagination.of parses `field,direction` and allow-lists the field, so a colon form or an
    // unknown column must never leave the app as a link.
    expect(queryToSearchParams({ ...empty, sort: "price:desc" }).get("sort")).toBeNull();
    expect(queryToSearchParams({ ...empty, sort: "colour,asc" }).get("sort")).toBeNull();
    expect(queryToSearchParams({ ...empty, sort: "price,desc" }).get("sort")).toBe("price,desc");
  });

  it("round-trips a facet URL through parse and back", () => {
    const url = "gender=women&sizes=xl&colors=bone&minPrice=3000&sort=rating%2Cdesc&page=2";
    expect(queryToSearchParams(parse(`/products?${url}`)).toString()).toBe(url);
  });
});

describe("toUrlSearchParams", () => {
  it("flattens the array values Next gives a repeated param", () => {
    const params = toUrlSearchParams({ sizes: ["s", "m"], gender: "men", keyword: undefined });
    expect(params.getAll("sizes")).toEqual(["s", "m"]);
    expect(params.get("gender")).toBe("men");
    expect(params.has("keyword")).toBe(false);
  });
});

describe("facet links", () => {
  it("adds a size and resets the page", () => {
    const href = catalogHref({ ...empty, gender: "men", page: 4 }, { sizes: ["l"] });
    expect(href).toBe("/products?gender=men&sizes=l");
  });

  it("toggles a facet off when it is already applied", () => {
    const query = { ...empty, sizes: ["s", "m"] };
    expect(toggleFacet(query, "sizes", "M").sizes).toEqual(["s"]);
    expect(toggleFacet(query, "sizes", "xl").sizes).toEqual(["s", "m", "xl"]);
  });

  it("removes the parameter entirely when the last value is toggled off", () => {
    const query = { ...empty, sizes: ["s"], colors: ["bone"] };
    expect(catalogHref(toggleFacet(query, "sizes", "s"))).toBe("/products?colors=bone");
  });

  it("clears a facet when the patch is null", () => {
    const query = { ...empty, category: "mens-denim", gender: "men" };
    expect(catalogHref(query, { category: null })).toBe("/products?gender=men");
  });

  it("falls back to the default page size rather than emitting 'undefined'", () => {
    const merged = mergeQuery({ ...empty, size: 40 }, { size: null });
    expect(queryToSearchParams(merged).toString()).toBe("");
  });
});

describe("activeFacetCount", () => {
  it("counts a price band once, not per bound", () => {
    expect(activeFacetCount({ ...empty, minPrice: "100", maxPrice: "900" })).toBe(1);
    expect(activeFacetCount({ ...empty, sizes: ["s", "m"], gender: "men" })).toBe(3);
    expect(activeFacetCount(empty)).toBe(0);
  });
});
