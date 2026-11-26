"use client";

import Image, { type ImageProps } from "next/image";

const FALLBACK_IMAGE = "/media/terrain-fallback.jpg";

function resolveSafeSrc(src?: string | null): {
  src: string;
  unoptimized: boolean;
} {
  const trimmed = (src || "").trim();
  if (!trimmed) {
    return { src: FALLBACK_IMAGE, unoptimized: false };
  }
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.toLowerCase().endsWith(".svg")
  ) {
    return { src: trimmed, unoptimized: true };
  }
  if (trimmed.startsWith("/")) {
    return { src: trimmed, unoptimized: false };
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return { src: trimmed, unoptimized: false };
  }
  return { src: FALLBACK_IMAGE, unoptimized: false };
}

export type StoreImageProps = Omit<ImageProps, "src" | "alt"> & {
  src?: string | null;
  alt: string;
  "data-builder-part"?: string;
};

export function StoreImage({
  src,
  alt,
  unoptimized,
  ...rest
}: StoreImageProps) {
  const resolved = resolveSafeSrc(src);
  return (
    <Image
      src={resolved.src}
      alt={alt}
      unoptimized={unoptimized ?? resolved.unoptimized}
      {...rest}
    />
  );
}
