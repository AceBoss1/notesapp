"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { MAIN_HOST } from "@/lib/host";
import { CHALLENGE_PROMO, challengePromoActive } from "@/lib/challenge-promo";

// A full-screen welcome: the logo and two buttons. Someone already signed in never sees the buttons; they go to their journal.
export default function Splash() {
  const router = useRouter();
  const [signedOut, setSignedOut] = useState(false);
  const [promo, setPromo] = useState<boolean | null>(null); // decided in an effect so server and browser render the same first
  useEffect(() => setPromo(challengePromoActive()), []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/journals");
      else setSignedOut(true);
    });
  }, [router]);

  return (
    <div className="md:grid md:min-h-screen md:grid-cols-2">
      {/* Tablet and desktop: the left half carries the challenge announcement (same gradient and wording as the home-page hero). */}
      <aside className="hidden flex-col items-center justify-center border-r border-rule bg-gradient-to-b from-crimson/10 via-white to-white px-10 py-12 text-center md:flex">
        {promo === true && (
          <>
            <div className="flex items-end gap-1" aria-hidden>
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
            <p className="mt-6 font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">Coming soon · For influencers</p>
            <h2 className="mt-2 font-display text-3xl text-ink lg:text-4xl">{CHALLENGE_PROMO.name}</h2>
            <p className="mt-3 max-w-md text-slate">
              Reach 100k views and 10k followers to unlock LIVE video, then bring 2,000 registered members into one live to open a
              ₦1,000,000 giveaway for you and your followers.
            </p>
            <a href={`https://${MAIN_HOST}${CHALLENGE_PROMO.href}`} className="btn-primary mt-5">Read about the Challenge</a>
            <a href={`https://${MAIN_HOST}${CHALLENGE_PROMO.href}`} className="mt-8 block" aria-label="Read about the #1MillionNairaNotesAppChallenge">
              <Image
                src="/images/brand/challenge-graphic.webp"
                alt="#1MillionNairaNotesAppChallenge: ₦10m up for grabs this month"
                width={1536}
                height={1024}
                sizes="(min-width: 1024px) 340px, 260px"
                className="h-auto w-[260px] max-w-full lg:w-[340px]"
              />
            </a>
            <style>{`
              @keyframes na-wave { 0%,100% { transform: skewY(0deg) translateY(0); } 50% { transform: skewY(-3deg) translateY(1px); } }
              .na-flag { transform-origin: 12px 35px; animation: na-wave 2.4s ease-in-out infinite; }
              @media (prefers-reduced-motion: reduce) { .na-flag { animation: none; } }
            `}</style>
          </>
        )}
        {promo === false && (
          <>
            <Image src="/images/brand/notesapp-icon.webp" alt="" width={128} height={128} className="h-32 w-32 rounded-3xl shadow-md" />
            <p className="mt-8 font-ui text-5xl font-extrabold tracking-tight text-ink">
              Notes<span className="text-crimson">App</span>
            </p>
            <p className="mt-4 max-w-sm text-lg text-slate">Publish a note, take a booking, get paid.</p>
          </>
        )}
      </aside>
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center md:min-h-0">
      <Image src="/images/brand/notesapp-icon.webp" alt="#NotesApp" width={96} height={96} priority className="h-24 w-24 rounded-2xl" />
      <h1 className="mt-6 font-ui text-4xl font-extrabold tracking-tight text-ink">
        Notes<span className="text-crimson">App</span>
      </h1>
      <p className="mt-3 max-w-xs text-slate">Publish a note, take a booking, get paid.</p>
      <div className="mt-10 flex min-h-[7rem] w-full max-w-xs flex-col gap-3">
        {signedOut && (
          <>
            <Link href="/signup" className="btn-primary text-center">Create an account</Link>
            <Link href="/login" className="btn-ghost text-center">Sign in</Link>
          </>
        )}
      </div>
      <p className="mt-10 text-xs text-slate">
        By continuing you agree to the{" "}
        <a href={`https://${MAIN_HOST}/terms`} className="underline">Terms</a> and{" "}
        <a href={`https://${MAIN_HOST}/privacy`} className="underline">Privacy Policy</a>.
      </p>
    </main>
    </div>
  );
}
