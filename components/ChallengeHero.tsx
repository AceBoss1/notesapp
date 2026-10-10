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
    <section className="relative overflow-hidden text-paper" style={{ backgroundImage: "radial-gradient(60rem 26rem at 90% -20%, rgba(166,9,61,0.7), transparent 70%), linear-gradient(135deg, #4E0119 0%, #7A0328 100%)" }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-12 text-center sm:flex-row sm:text-left lg:px-8">
        <Image src="/images/nana/nana.webp" alt="" aria-hidden width={160} height={160} className="hidden h-36 w-36 shrink-0 object-contain drop-shadow-xl lg:block" />
        <div>
          <p className="font-mono text-xs uppercase tracking-eyebrow text-paper/70">Coming soon · For influencers</p>
          <h2 className="mt-2 font-display text-3xl text-paper sm:text-4xl">{CHALLENGE_PROMO.name}</h2>
          <p className="mt-3 max-w-2xl text-paper/85">
            Reach 100k views and 10k followers to unlock LIVE video, then bring 2,000 registered members into one live to open a
            ₦1,000,000 giveaway for you and your followers.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
            <Link href={CHALLENGE_PROMO.href} className="rounded-full bg-paper px-6 py-3 font-ui text-sm font-bold text-crimson-deep hover:opacity-90">Read about the Challenge</Link>
            <Link href="/signup" className="rounded-full border border-paper/40 px-6 py-3 font-ui text-sm font-bold text-paper hover:bg-paper/10">Create your free account</Link>
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
    </section>
  );
}
