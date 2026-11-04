import Link from "next/link";
import { cn } from "@/lib/utils";
import { catalogHref, dropKeywordWord } from "@/lib/catalog/query-state";
import type { CatalogQuery, SearchPage } from "@/lib/catalog/server";

const FACET_LABEL: Record<string, string> = { color: "Colour", size: "Size" };

/**
 * The backend reads colour and size words out of the search box and turns them into filters, so
 * “black tee” means tee AND black rather than a title containing both. These chips say so, and
 * each one hands the shopper back the word it was inferred from — the remaining words are read
 * again on the next request, so taking one off leaves the others alone.
 */
export function InferredFacets({ query, results }: { query: CatalogQuery; results: SearchPage }) {
  const chips = results.inferredFacets ?? [];
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Filtered by your own words:</span>
      {chips.map((chip) => (
        <Link
          key={`${chip.facet}-${chip.value}-${chip.word}`}
          href={catalogHref(query, { keyword: dropKeywordWord(query.keyword, chip.word) ?? null })}
          aria-label={`Stop filtering by ${FACET_LABEL[chip.facet]} ${chip.value}`}
          className={cn(
            "inline-flex items-center gap-2 border px-3 py-1.5 text-sm transition-colors",
            "border-foreground bg-foreground text-background",
            "hover:bg-transparent hover:text-foreground",
          )}
        >
          <span>
            {FACET_LABEL[chip.facet]}: {chip.value}
          </span>
          <span className="opacity-70">“{chip.word}”</span>
          <span aria-hidden="true" className="text-base leading-none">
            ×
          </span>
        </Link>
      ))}
    </div>
  );
}
