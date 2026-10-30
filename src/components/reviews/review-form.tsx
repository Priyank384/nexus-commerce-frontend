"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HttpError } from "@/lib/api/errors";
import { useCreateReview } from "@/lib/reviews/queries";
import { RatingPicker } from "./rating-stars";

export function ReviewForm({
  productId,
  productTitle,
  orderId,
  open,
  onOpenChange,
}: {
  productId: number;
  productTitle: string;
  orderId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const create = useCreateReview(productId);
  const router = useRouter();

  async function submit() {
    if (!rating) {
      toast.error("Pick a star rating first.");
      return;
    }
    try {
      await create.mutateAsync({
        orderId,
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      toast.success("Thank you — your review is live.");
      setRating(0);
      setComment("");
      onOpenChange(false);
      // The aggregate in the section header is server-rendered from the product row, so only
      // a refresh of this route can show the new average and count.
      router.refresh();
    } catch (error) {
      toast.error(error instanceof HttpError ? error.message : "Could not post the review.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review {productTitle}</DialogTitle>
          <DialogDescription>
            Verified purchase. Your rating appears on the product straight away.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <span className="block text-sm font-medium leading-none">Rating</span>
            <RatingPicker value={rating} onChange={setRating} disabled={create.isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-comment">Your review · optional</Label>
            <Textarea
              id="review-comment"
              value={comment}
              maxLength={2000}
              rows={5}
              placeholder="How does it fit? How has it washed?"
              aria-describedby="review-comment-count"
              onChange={(event) => setComment(event.target.value)}
            />
            <p id="review-comment-count" className="text-xs text-muted-foreground">
              {comment.length} / 2000
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending || !rating}>
            {create.isPending ? "Posting…" : "Post review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
