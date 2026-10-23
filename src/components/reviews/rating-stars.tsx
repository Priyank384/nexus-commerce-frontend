"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({
  value,
  size = "size-4",
  className,
}: {
  value: number;
  size?: string;
  className?: string;
}) {
  const filled = Math.round(value);
  return (
    <span
      role="img"
      aria-label={`${value.toFixed(1)} out of 5`}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          strokeWidth={1.25}
          className={cn(size, star <= filled ? "fill-foreground" : "fill-none text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}

/** Interactive 1–5 picker; buttons rather than radios so a star reads as one large target. */
export function RatingPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div role="group" aria-label="Rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          aria-pressed={value === star}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onFocus={() => setHovered(star)}
          onBlur={() => setHovered(0)}
          className="rounded-sm p-0.5 text-foreground disabled:opacity-50"
        >
          <Star
            aria-hidden
            strokeWidth={1.25}
            className={cn("size-7", star <= shown ? "fill-foreground" : "fill-none text-muted-foreground/40")}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">{value ? `${value} / 5` : "Choose a rating"}</span>
    </div>
  );
}
