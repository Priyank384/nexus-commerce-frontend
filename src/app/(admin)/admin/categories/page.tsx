import { AdminCategoryManager } from "@/components/admin/category-manager";

// Segment config has to live on the segment itself: a parent layout's opt-out does not silence
// the instant-navigation validator for a client child, and every admin tab fetches client-side.
export const instant = false;

export default function AdminCategoriesPage() {
  return <AdminCategoryManager />;
}
