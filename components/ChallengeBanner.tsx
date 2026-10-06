"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CHALLENGE_PROMO, challengePromoActive } from "@/lib/challenge-promo";

const KEY = "na-challenge-bar-dismissed";

// Slim bar at the very top of every page for the #1MillionNairaNotesAppChallenge, once the Independence Day bar has
// expired. Dismissible, remembered per browser.
export default function ChallengeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {
      /* storage unavailable — just show it */
    }
    setShow(challengePromoActive() && !dismissed);
  }, []);

  if (!show) return null;
  return (
    <div className="relative bg-crimson text-white" role="region" aria-label="#1MillionNairaNotesAppChallenge announcement">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-10 py-2 text-center font-ui text-xs sm:text-sm">
        <p>
          <strong>{CHALLENGE_PROMO.name}</strong>{" "}
          <span className="hidden sm:inline">for influencers is coming soon — </span>
          <span className="sm:hidden">coming soon — </span>
          <Link href={CHALLENGE_PROMO.href} className="font-bold underline underline-offset-2">
            read about it →
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
