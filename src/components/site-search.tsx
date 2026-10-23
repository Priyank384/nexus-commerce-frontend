"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Search is a real GET form — the keyword rides the same `keyword` param the listing reads, so
 * results are shareable and work without JS. Once hydrated the submit is handled on the client
 * instead: a native GET submit is a full document load, and in dev it races the header's own
 * hydration, which can swallow the click entirely.
 */
export function SiteSearch({ className, compact = false }: { className?: string; compact?: boolean }) {
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = String(new FormData(event.currentTarget).get("keyword") ?? "").trim();
    router.push(keyword ? `/products?keyword=${encodeURIComponent(keyword)}` : "/products");
  }

  return (
    <form
      action="/products"
      method="get"
      role="search"
      onSubmit={onSubmit}
      className={cn(
        "flex items-center gap-2 border bg-transparent",
        compact ? "h-11 w-full px-3" : "h-9 w-40 px-2.5",
        className,
      )}
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">Search products</span>
        <input
          name="keyword"
          type="search"
          placeholder="Search"
          /* WebKit draws its own magnifier inside a search field; the submit button already
             carries one, and the field is too narrow to say it twice. */
          className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-decoration]:hidden"
        />
      </label>
      <button
        type="submit"
        aria-label="Search"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <Search aria-hidden className="size-4" />
      </button>
    </form>
  );
}
