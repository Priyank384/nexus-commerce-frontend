import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice, sortSizes } from "@/lib/catalog/format";
import {
  SORT_OPTIONS,
  activeFacetCount,
  catalogHref,
  toggleFacet,
} from "@/lib/catalog/query-state";
import type { CatalogQuery, FacetRoot } from "@/lib/catalog/server";

/** A facet link: it changes one thing, resets the page, and styles itself when already applied. */
function FacetLink({
  href,
  active,
  children,
  className,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-5 first:border-t-0 first:pt-0">
      <p className="label-caps mb-3 text-muted-foreground">{label}</p>
      {children}
    </section>
  );
}

/**
 * GET forms so filtering needs no JavaScript at all: the browser builds the query string itself.
 * Every field is `name`-matched to the URL, and the page resets because `page` is never in the form.
 */
function HiddenFacets({
  query,
  includeSort = true,
}: {
  query: CatalogQuery;
  includeSort?: boolean;
}) {
  return (
    <>
      {query.gender ? <input type="hidden" name="gender" value={query.gender} /> : null}
      {query.category ? <input type="hidden" name="category" value={query.category} /> : null}
      {query.keyword ? <input type="hidden" name="keyword" value={query.keyword} /> : null}
      {(query.sizes ?? []).map((size) => (
        <input key={`s-${size}`} type="hidden" name="sizes" value={size} />
      ))}
      {(query.colors ?? []).map((color) => (
        <input key={`c-${color}`} type="hidden" name="colors" value={color} />
      ))}
      {/* A form that submits sort twice sends `sort=id,asc,price,desc`, which the backend
          reject-lists as an unknown field — the sort form supplies its own. */}
      {includeSort && query.sort ? <input type="hidden" name="sort" value={query.sort} /> : null}
    </>
  );
}

function PriceForm({ query }: { query: CatalogQuery }) {
  return (
    <form className="flex items-center gap-2" action="/products" method="get">
      <HiddenFacets query={query} />
      <label className="sr-only" htmlFor="minPrice">
        Minimum price
      </label>
      <input
        id="minPrice"
        name="minPrice"
        type="number"
        min={0}
        inputMode="numeric"
        placeholder="Min"
        defaultValue={query.minPrice ?? ""}
        className="h-9 w-20 border border-border bg-transparent px-2 text-sm"
      />
      <label className="sr-only" htmlFor="maxPrice">
        Maximum price
      </label>
      <input
        id="maxPrice"
        name="maxPrice"
        type="number"
        min={0}
        inputMode="numeric"
        placeholder="Max"
        defaultValue={query.maxPrice ?? ""}
        className="h-9 w-20 border border-border bg-transparent px-2 text-sm"
      />
      <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        Go
      </button>
    </form>
  );
}

function SortForm({ query }: { query: CatalogQuery }) {
  return (
    <form className="flex items-center gap-2" action="/products" method="get">
      <HiddenFacets query={query} includeSort={false} />
      <label className="sr-only" htmlFor="sort">
        Sort by
      </label>
      <select
        id="sort"
        name="sort"
        defaultValue={query.sort ?? "id,asc"}
        className="h-9 flex-1 border border-border bg-transparent px-2 text-sm"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        Apply
      </button>
    </form>
  );
}

export function FacetPanel({
  query,
  categories,
  sizes,
  colors,
}: {
  query: CatalogQuery;
  categories: FacetRoot[];
  sizes: string[];
  colors: string[];
}) {
  const active = activeFacetCount(query);

  return (
    <aside aria-label="Filter products">
      <div className="flex items-baseline justify-between">
        {/* The disclosure already labels this on small screens. */}
        <p className="label-caps hidden lg:block">Refine</p>
        {active > 0 ? (
          <Link href="/products" className="text-xs underline underline-offset-4">
            Clear ({active})
          </Link>
        ) : null}
      </div>

      <Group label="Department">
        <div className="flex flex-wrap gap-2">
          <FacetLink href={catalogHref(query, { gender: null })} active={!query.gender}>
            Everything
          </FacetLink>
          {categories.map((root) => (
            <FacetLink
              key={root.slug}
              href={catalogHref(query, { gender: root.slug, category: null })}
              active={query.gender === root.slug}
            >
              {root.name}
            </FacetLink>
          ))}
        </div>
      </Group>

      {categories.map((root) => {
        // Only expand the subtree the shopper is already inside; otherwise the panel is 14 links tall.
        const show = !query.gender || query.gender === root.slug;
        if (!show || !root.children?.length) return null;
        return (
          <Group key={root.slug} label={root.name}>
            <ul className="space-y-1.5">
              {root.children.map((child) => (
                <li key={child.slug}>
                  <Link
                    href={catalogHref(query, { category: child.slug })}
                    className={cn(
                      "text-sm hover:underline hover:underline-offset-4",
                      query.category === child.slug
                        ? "text-foreground underline underline-offset-4"
                        : "text-muted-foreground",
                    )}
                  >
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Group>
        );
      })}

      {sizes.length ? (
        <Group label="Size">
          <div className="flex flex-wrap gap-2">
            {sortSizes(sizes).map((size) => (
              <FacetLink
                key={size}
                href={catalogHref(toggleFacet(query, "sizes", size))}
                active={query.sizes?.includes(size.toLowerCase()) ?? false}
                className="min-w-11 justify-center"
              >
                {size}
              </FacetLink>
            ))}
          </div>
        </Group>
      ) : null}

      {colors.length ? (
        <Group label="Colour">
          <div className="flex flex-wrap gap-2">
            {[...colors]
              .sort((a, b) => a.localeCompare(b))
              .map((color) => (
                <FacetLink
                  key={color}
                  href={catalogHref(toggleFacet(query, "colors", color))}
                  active={query.colors?.includes(color.toLowerCase()) ?? false}
                >
                  {color}
                </FacetLink>
              ))}
          </div>
        </Group>
      ) : null}

      <Group label="Price">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Under ₹3,000", min: undefined, max: "2999" },
            { label: "₹3,000–₹6,000", min: "3000", max: "6000" },
            { label: "Over ₹6,000", min: "6001", max: undefined },
          ].map((band) => {
            const isActive = query.minPrice === band.min && query.maxPrice === band.max;
            return (
              <FacetLink
                key={band.label}
                href={catalogHref(query, { minPrice: band.min ?? null, maxPrice: band.max ?? null })}
                active={isActive}
              >
                {band.label}
              </FacetLink>
            );
          })}
        </div>
        <div className="mt-3">
          <PriceForm query={query} />
        </div>
      </Group>

      <Group label="Sort">
        <SortForm query={query} />
      </Group>

      {query.minPrice || query.maxPrice ? (
        <p className="pt-2 text-xs text-muted-foreground">
          {query.minPrice ? `From ${formatPrice(Number(query.minPrice))}` : null}
          {query.minPrice && query.maxPrice ? " · " : null}
          {query.maxPrice ? `Up to ${formatPrice(Number(query.maxPrice))}` : null}
        </p>
      ) : null}
    </aside>
  );
}
