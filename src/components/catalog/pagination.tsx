import Link from "next/link";
import { cn } from "@/lib/utils";
import { catalogHref } from "@/lib/catalog/query-state";
import type { CatalogQuery, PageMeta } from "@/lib/catalog/server";

/** Window of page indexes to show, always centred on the current one where there is room. */
export function pageIndexes(current: number, total: number, span = 2): number[] {
  if (total <= 1) return [];
  const start = Math.max(0, Math.min(current - span, total - 1 - span * 2));
  const end = Math.min(total - 1, start + span * 2);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function PageLink({
  href,
  label,
  current,
  disabled,
}: {
  href: string;
  label: string;
  current?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span aria-disabled className="px-2 py-1 text-muted-foreground/40">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "px-2 py-1 hover:underline hover:underline-offset-4",
        current ? "font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
    </Link>
  );
}

export function Pagination({ query, page }: { query: CatalogQuery; page: PageMeta }) {
  if (page.totalPages <= 1) return null;
  const indexes = pageIndexes(page.page, page.totalPages);
  const atStart = page.page <= 0;
  const atEnd = page.last || page.page >= page.totalPages - 1;

  return (
    <nav aria-label="Pagination" className="flex items-center gap-1 border-t border-border pt-6 text-sm">
      <PageLink href={catalogHref(query, { page: page.page - 1 })} label="Previous" disabled={atStart} />
      {indexes.length > 0 && indexes[0] > 0 ? (
        <PageLink href={catalogHref(query, { page: 0 })} label="1" />
      ) : null}
      {indexes.length > 0 && indexes[0] > 1 ? <span aria-hidden>…</span> : null}
      {indexes.map((index) => (
        <PageLink
          key={index}
          href={catalogHref(query, { page: index })}
          label={String(index + 1)}
          current={index === page.page}
        />
      ))}
      {indexes.length > 0 && indexes[indexes.length - 1] < page.totalPages - 2 ? (
        <span aria-hidden>…</span>
      ) : null}
      {indexes.length > 0 && indexes[indexes.length - 1] < page.totalPages - 1 ? (
        <PageLink href={catalogHref(query, { page: page.totalPages - 1 })} label={String(page.totalPages)} />
      ) : null}
      <PageLink href={catalogHref(query, { page: page.page + 1 })} label="Next" disabled={atEnd} />
    </nav>
  );
}
