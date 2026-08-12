"use client";

import { useState } from "react";
import { DEFAULT_AVATAR } from "@/lib/admin";

export default function Avatar({
  src,
  alt,
  size,
  className = "",
}: {
  src: string;
  alt: string;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

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
      className={`rounded-full border border-rule object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
