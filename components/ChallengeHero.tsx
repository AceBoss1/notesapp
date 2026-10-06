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
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-10 text-center sm:flex-row sm:text-left lg:px-8">
        <Image src="/images/brand/notesapp-icon.webp" alt="" width={84} height={84} className="h-20 w-20 shrink-0 rounded-2xl shadow-md" aria-hidden />
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
      </div>
    </section>
  );
}
