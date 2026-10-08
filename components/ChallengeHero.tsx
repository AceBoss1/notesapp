"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CHALLENGE_PROMO, challengePromoActive } from "@/lib/challenge-promo";

// Home-page hero for the #1MillionNairaNotesAppChallenge. Appears by itself once the Independence Day hero has expired.
export default function ChallengeHero() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(challengePromoActive()), []);
  if (!show) return null;

  return (
    <section className="border-b border-rule bg-gradient-to-b from-crimson/10 via-white to-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-10 text-center sm:flex-row sm:text-left lg:px-8">
        <div className="relative flex shrink-0 items-end gap-1" aria-hidden>
          <Image src="/images/brand/notesapp-icon.webp" alt="" width={84} height={84} className="h-20 w-20 rounded-2xl shadow-md" />
          <svg viewBox="0 0 90 120" className="h-24 w-[72px]">
            <rect x="8" y="6" width="4" height="110" rx="2" fill="#8a6a2f" />
            <circle cx="10" cy="6" r="4.5" fill="#c99a1b" />
            <g className="na-flag">
              <path d="M12 12 C 28 6, 44 18, 62 12 L 62 58 C 44 64, 28 52, 12 58 Z" fill="#fff" stroke="#d9d4cc" strokeWidth="0.8" />
              <path d="M12 12 C 18 9.5, 24 11, 29 13.5 L 29 59.5 C 24 57, 18 55.5, 12 58 Z" fill="#008751" />
              <path d="M45 13.5 C 51 14, 56 13.5, 62 12 L 62 58 C 56 59.5, 51 60, 45 59.5 Z" fill="#008751" />
            </g>
          </svg>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">Coming soon · For influencers</p>
          <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{CHALLENGE_PROMO.name}</h2>
          <p className="mt-3 max-w-2xl text-slate">
            Reach 100k views and 10k followers to unlock LIVE video, then bring 2,000 registered members into one live to open a
            ₦1,000,000 giveaway for you and your followers.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
            <Link href={CHALLENGE_PROMO.href} className="btn-primary">Read about the Challenge</Link>
            <Link href="/signup" className="btn-ghost">Create your free account</Link>
          </div>
        </div>
        {/* The campaign artwork, on the right: opens the challenge page. */}
        <Link href={CHALLENGE_PROMO.href} className="shrink-0 sm:ml-auto" aria-label="Read about the #1MillionNairaNotesAppChallenge">
          <Image
            src="/images/brand/challenge-graphic.webp"
            alt="#1MillionNairaNotesAppChallenge: ₦10m up for grabs this month"
            width={1536}
            height={1024}
            sizes="(min-width: 1024px) 340px, (min-width: 640px) 260px, 300px"
            className="h-auto w-[300px] max-w-full sm:w-[260px] lg:w-[340px]"
          />
        </Link>
      </div>
      <style>{`
        @keyframes na-wave { 0%,100% { transform: skewY(0deg) translateY(0); } 50% { transform: skewY(-3deg) translateY(1px); } }
        .na-flag { transform-origin: 12px 35px; animation: na-wave 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .na-flag { animation: none; } }
      `}</style>
    </section>
  );
}
