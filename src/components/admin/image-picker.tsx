"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function rejectedImage(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return `${file.name} is not a PNG, JPEG or WebP.`;
  }
  if (file.size > MAX_IMAGE_BYTES) return `${file.name} is over 5 MB.`;
  return null;
}

export function ImagePicker({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const [rejected, setRejected] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function add(selected: FileList | null) {
    if (!selected) return;
    const next: File[] = [];
    const problems: string[] = [];
    for (const file of Array.from(selected)) {
      const problem = rejectedImage(file);
      if (problem) problems.push(problem);
      else next.push(file);
    }
    setRejected(problems);
    if (next.length > 0) onChange([...files, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        className="sr-only"
        aria-label="Product images"
        onChange={(event) => add(event.target.files)}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <ImagePlus aria-hidden />
        Add images
      </Button>
      <p className="text-xs text-muted-foreground">
        PNG, JPEG or WebP, up to 5 MB each. The first image becomes the thumbnail.
      </p>

      {rejected.length > 0 ? (
        <ul className="space-y-1 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {rejected.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`} className="group relative">
              <div className="relative aspect-[3/4] overflow-hidden rounded-sm border bg-muted">
                {previews[index] ? (
                  <Image
                    src={previews[index]}
                    alt=""
                    fill
                    unoptimized
                    sizes="160px"
                    className="object-cover"
                  />
                ) : null}
                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide">
                    Thumbnail
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-xs"
                  aria-label={`Remove ${file.name}`}
                  className="absolute right-2 top-2"
                  onClick={() => onChange(files.filter((_, position) => position !== index))}
                >
                  <X aria-hidden />
                </Button>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground" title={file.name}>
                {file.name}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
