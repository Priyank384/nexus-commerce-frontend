"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rejectedImage } from "@/components/admin/image-picker";
import {
  useAppendGalleryImage,
  useDeleteGalleryImage,
  useReorderGallery,
  type AdminProduct,
  type AdminProductImage,
} from "@/lib/admin/products";

export function GalleryManager({ product }: { product: AdminProduct }) {
  const productId = product.id!;
  const images = product.images ?? [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [target, setTarget] = useState<AdminProductImage | null>(null);

  const append = useAppendGalleryImage(productId);
  const remove = useDeleteGalleryImage(productId);
  const reorder = useReorderGallery(productId);

  async function upload(selected: FileList | null) {
    if (!selected) return;
    const files = Array.from(selected);
    const valid: File[] = [];
    for (const file of files) {
      const problem = rejectedImage(file);
      if (problem) toast.error(problem);
      else valid.push(file);
    }
    if (inputRef.current) inputRef.current.value = "";
    if (valid.length === 0) return;

    setUploading(true);
    let failed = 0;
    for (const file of valid) {
      try {
        await append.mutateAsync(file);
      } catch (error) {
        failed += 1;
        toast.error(`${file.name}: ${error instanceof Error ? error.message : "upload failed"}`);
      }
    }
    setUploading(false);
    if (failed < valid.length) {
      toast.success(valid.length - failed === 1 ? "Image added" : `${valid.length - failed} images added`);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...images];
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    reorder.mutate(next.map((image) => image.id!), {
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        aria-label="Add gallery images"
        onChange={(event) => void upload(event.target.files)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          The first image is the thumbnail on cards. Move images to change it.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus aria-hidden />
          {uploading ? "Uploading…" : "Add images"}
        </Button>
      </div>

      {images.length === 0 ? (
        <p className="border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No gallery images yet. Add one to appear on the product page.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <li key={image.id} className="space-y-1.5">
              <div className="relative aspect-[3/4] overflow-hidden rounded-sm border bg-muted">
                {image.url ? (
                  <Image
                    src={image.url}
                    alt={image.alt ?? ""}
                    fill
                    sizes="(min-width: 640px) 180px, 45vw"
                    className="object-cover"
                  />
                ) : null}
                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide">
                    Thumbnail
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between">
                <span className="label-caps text-muted-foreground">#{index + 1}</span>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move image ${index + 1} up`}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move image ${index + 1} down`}
                    disabled={index === images.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete image ${index + 1}`}
                    onClick={() => setTarget(image)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={target !== null} onOpenChange={(open) => (open ? null : setTarget(null))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this image?</DialogTitle>
            <DialogDescription>
              It leaves the gallery immediately. If it was the thumbnail, the next image takes its
              place.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (!target?.id) return;
                remove.mutate(target.id, {
                  onSuccess: () => {
                    setTarget(null);
                    toast.success("Image removed");
                  },
                  onError: (error) => toast.error(error.message),
                });
              }}
            >
              {remove.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
