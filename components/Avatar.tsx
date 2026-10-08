"use client";

import { useEffect, useState } from "react";
import { DEFAULT_AVATAR } from "@/lib/admin";

export default function Avatar({
  src,
  alt,
  size,
  className = "",
  square = false,
}: {
  src: string;
  alt: string;
  size: number;
  className?: string;
  square?: boolean; // a rounded square instead of a circle (profile blocks)
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]); // a new picture gets its own chance (an empty or broken one earlier must not stick)

  return (
    // Plain <img>, not next/image — this needs a runtime onError
    // fallback (a missing headshot on someone's disk shouldn't ever
    // break the page), which next/image's static optimization doesn't
    // support well for local files.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={failed ? DEFAULT_AVATAR : src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`${square ? "rounded-2xl" : "rounded-full"} border border-rule object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
