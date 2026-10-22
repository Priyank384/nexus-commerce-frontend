import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: { label: string; href: string };
};

/**
 * One voice for every "nothing here yet" surface — empty bag, wishlist, order
 * history, filtered catalogue. Dashed border so it reads as a slot to fill
 * rather than a panel holding content.
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 border-y border-dashed py-20 text-center">
      <h2 className="text-lg">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <Link href={action.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
