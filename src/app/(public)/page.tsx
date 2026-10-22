import { redirect } from "next/navigation";

// Home is a stub for Phase 0; Phase 2 replaces it with featured products / hero.
export default function HomePage() {
  redirect("/products");
}
