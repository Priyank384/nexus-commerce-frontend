"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth/session";
import { useProductReviews, useReviewableOrder } from "@/lib/reviews/queries";
import { RatingStars } from "./rating-stars";
import { ReviewForm } from "./review-form";

function reviewDate(value: string | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ProductReviews({
  productId,
  productTitle,
  rating,
  reviewCount,
}: {
  productId: number;
  productTitle: string;
  rating?: number;
  reviewCount?: number;
}) {
  const pathname = usePathname();
  const { user } = useSession();
  const reviews = useProductReviews(productId);
  const reviewable = useReviewableOrder(productId, Boolean(user));
  const [formOpen, setFormOpen] = useState(false);

  const items = reviews.data?.pages.flatMap((page) => page.content ?? []) ?? [];
  const average = rating ?? 0;
  const count = reviewCount ?? items.length;
  const canReview = typeof reviewable.data === "number";

  return (
    <section aria-labelledby="reviews-heading" className="border-t pt-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 id="reviews-heading" className="text-xl md:text-2xl">
            Reviews
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {count > 0 ? (
              <>
                <RatingStars value={average} />
                <span className="text-sm">
                  {average.toFixed(1)} · {count} {count === 1 ? "review" : "reviews"}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No reviews yet — be the first.</span>
            )}
          </div>
        </div>

        {user ? (
          canReview ? (
            <Button variant="outline" onClick={() => setFormOpen(true)}>
              Write a review
            </Button>
          ) : reviewable.isSuccess ? (
            <p className="text-xs text-muted-foreground">
              Reviews come from verified buyers, one per purchase.
            </p>
          ) : null
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="text-sm underline underline-offset-4 hover:opacity-70"
          >
            Sign in to review
          </Link>
        )}
      </div>

      {reviews.isPending ? (
        <div className="mt-8 space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {reviews.isError ? (
        <p role="alert" className="mt-6 text-sm text-muted-foreground">
          We could not load the reviews right now.
        </p>
      ) : null}

      {reviews.isSuccess && !items.length ? (
        <p className="mt-6 border p-6 text-sm text-muted-foreground">
          Nothing written yet. If this piece is yours, tell the next person how it wears.
        </p>
      ) : null}

      <ul className="mt-8 divide-y border-t">
        {items.map((review) => (
          <li key={review.id} className="py-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <RatingStars value={review.rating ?? 0} size="size-3.5" />
              <span className="text-sm">{review.reviewerName ?? "A customer"}</span>
              <span className="text-xs text-muted-foreground">{reviewDate(review.createdAt)}</span>
            </div>
            {review.comment ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{review.comment}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {reviews.hasNextPage ? (
        <div className="mt-2">
          <Button variant="outline" size="sm" disabled={reviews.isFetchingNextPage} onClick={() => reviews.fetchNextPage()}>
            {reviews.isFetchingNextPage ? "Loading…" : "Load more reviews"}
          </Button>
        </div>
      ) : null}

      {canReview ? (
        <ReviewForm
          productId={productId}
          productTitle={productTitle}
          orderId={reviewable.data as number}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      ) : null}
    </section>
  );
}
