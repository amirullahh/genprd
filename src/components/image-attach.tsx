"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { imageToDataUrl } from "@/lib/client";

export const MAX_IMAGES = 4;

/** Paperclip button that reads picked files into resized JPEG data URLs and appends them. */
export function ImageAttachButton({ images, onChange, disabled }: { images: string[]; onChange: (images: string[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return toast.error(`Maksimal ${MAX_IMAGES} gambar per pesan.`);
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, room);
    try {
      const encoded = await Promise.all(picked.map((f) => imageToDataUrl(f)));
      onChange([...images, ...encoded]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat gambar.");
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled || images.length >= MAX_IMAGES}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        title="Lampirkan gambar"
        aria-label="Lampirkan gambar"
      >
        <ImagePlus className="h-4 w-4" />
      </button>
    </>
  );
}

/** Editable thumbnail strip for images staged before sending (click × to remove). */
export function ImagePreviewStrip({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  if (!images.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-2 pt-2">
      {images.map((src, i) => (
        <div key={i} className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover" />
          <button
            onClick={() => onChange(images.filter((_, j) => j !== i))}
            className="absolute top-0 right-0 rounded-bl bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100"
            aria-label="Hapus gambar"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Read-only thumbnail strip for rendering a sent message's attachments. */
export function ImageGrid({ images }: { images: string[] }) {
  if (!images.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {images.map((src, i) => (
        <a key={i} href={src} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-20 w-20 rounded-lg border object-cover" />
        </a>
      ))}
    </div>
  );
}
