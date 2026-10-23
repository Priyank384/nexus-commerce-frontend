import { EmptyState } from "@/components/empty-state";

export default function ProductNotFound() {
  return (
    <EmptyState
      title="We no longer carry that piece"
      description="The link may be from an old season. The current collection is all in one place."
      action={{ label: "Shop the collection", href: "/products" }}
    />
  );
}
