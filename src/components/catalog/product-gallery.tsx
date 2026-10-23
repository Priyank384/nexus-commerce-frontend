"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type GalleryImage = { url: string; alt: string };

/**
 * The gallery is client state because two things can move the main frame: a thumbnail click and
 * a colour selection elsewhere on the page. A new colour resets the frame to that colour's photo,
 * but the reset is the *only* thing the colour does — clicking a thumbnail afterwards has to show
 * that view, or the rail is dead. Storing the colour we were last reset by is how React says
 * "follow a prop until the user disagrees", and it needs no effect.
 */
export function ProductGallery({
  images,
  overrideUrl,
  overrideAlt,
}: {
  images: GalleryImage[];
  overrideUrl: string | null;
  overrideAlt?: string;
}) {
  const colour = overrideUrl ?? null;
  // `index === null` means "still following the colour". A thumbnail click pins a frame that
  // survives until the next colour change, which is when the shopper expects the picture to move.
  const [frame, setFrame] = useState<{ colour: string | null; index: number | null }>({
    colour,
    index: null,
  });
  if (frame.colour !== colour) setFrame({ colour, index: null });

  const shown = images[frame.index ?? 0];
  const url = frame.index === null ? (colour ?? shown?.url ?? null) : (shown?.url ?? null);
  const alt =
    (frame.index === null ? overrideAlt : undefined) ?? shown?.alt ?? images[0]?.alt ?? "Product";
  const activeIndex = images.findIndex((image) => image.url === url);

  if (!url) {
    return <div className="aspect-[4/5] w-full bg-muted" aria-hidden />;
  }

  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row">
      <div className="flex gap-2 overflow-x-auto md:w-20 md:flex-col md:overflow-visible">
        {images.map((image, i) => (
          <button
            key={image.url}
            type="button"
            onClick={() => setFrame({ colour, index: i })}
            aria-label={`View ${image.alt}`}
            aria-current={i === activeIndex}
            className={cn(
              "relative aspect-[4/5] w-14 shrink-0 overflow-hidden border transition-colors md:w-full",
              i === activeIndex ? "border-foreground" : "border-transparent hover:border-border",
            )}
          >
            <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>
      <div className="relative aspect-[4/5] w-full flex-1 overflow-hidden bg-muted">
        <Image
          src={url}
          alt={alt}
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}
