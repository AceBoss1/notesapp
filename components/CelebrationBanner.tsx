"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CELEBRATION, celebrationActive } from "@/lib/celebration";

const KEY = "na-celebration-2026-dismissed";

// Slim green-white-green bar at the very top of every page during the
// Independence Day / public-beta window. Dismissible, remembered per browser.
export default function CelebrationBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {
      /* storage unavailable — just show it */
    }
    setShow(celebrationActive() && !dismissed);
  }, []);

  if (!show) return null;
  return (
    <div className="relative bg-[#008751] text-white" role="region" aria-label="Independence Day and beta announcement">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-10 py-2 text-center font-ui text-xs sm:text-sm">
        <span aria-hidden>🇳🇬</span>
        <p>
          <strong>Happy Independence Day, Nigeria!</strong>{" "}
          <span className="hidden sm:inline">{CELEBRATION.beta.title} — </span>
          <span className="sm:hidden">Public beta is open — </span>
          <Link href={CELEBRATION.beta.href} className="font-bold underline underline-offset-2">
            read the launch note →
          </Link>
        </p>
      </div>
      <button
        onClick={() => {
          setShow(false);
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            /* ignore */
          }
        }}
        aria-label="Dismiss announcement"
        className="absolute right-3 top-1/2 -translate-y-1/2 px-2 text-lg leading-none text-white/80 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
