import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

// A 404 should not ship the home page's title. Next already marks these responses `noindex`,
// so no robots directive is needed here.
export const metadata: Metadata = {
  title: "Page not found",
};

/** Unmatched routes: keeps the shop shell and offers a way back into the catalogue. */
export default function NotFound() {
  return (
    <EmptyState
      title="This page has moved on"
      description="The address you followed doesn't exist. Everything in the current collection is one link away."
      action={{ label: "Shop the collection", href: "/products" }}
    />
  );
}
