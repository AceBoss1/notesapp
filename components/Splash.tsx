"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { MAIN_HOST } from "@/lib/host";
import { challengePromoActive } from "@/lib/challenge-promo";
import ChallengePanel from "@/components/ChallengePanel";

const MAIN = `https://${MAIN_HOST}`;

// The welcome screen of the app address: on a wide screen the challenge announcement in crimson on the left and a sign-up card on the right;
// on a phone just the card. Someone already signed in never sees the buttons; they go to their journal.
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

  const top = (
    <div className="relative flex items-center justify-between px-6 pt-6 lg:px-8">
      <span className="flex items-center gap-2.5">
        <Image src="/images/brand/notesapp-icon.webp" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
        <span className="font-ui text-xl font-extrabold tracking-tight text-paper">Notes<span className="text-[#FFB3C6]">App</span></span>
      </span>
      <nav className="flex gap-6 font-ui text-sm font-semibold text-paper/90" aria-label="More about #NotesApp">
        <a href={`${MAIN}/journals`} className="hover:underline">Explore</a>
        <a href={`${MAIN}/pricing`} className="hover:underline">Pricing</a>
        <a href={`${MAIN}/help`} className="hover:underline">Help</a>
      </nav>
    </div>
  );

  return (
    <div className="md:grid md:min-h-screen md:grid-cols-2">
      <aside className="hidden md:block">
        {promo === true ? (
          <ChallengePanel variant="panel" base={MAIN}>{top}</ChallengePanel>
        ) : (
          <div className="flex min-h-screen flex-col text-paper" style={{ backgroundImage: "linear-gradient(135deg, #4E0119 0%, #7A0328 100%)" }}>
            {top}
            <div className="my-auto px-10 text-center">
              <p className="font-display text-5xl">Publish. Book. Get paid.</p>
              <p className="mx-auto mt-4 max-w-sm text-lg text-paper/85">A home for African creators, professionals and businesses, in Naira.</p>
            </div>
          </div>
        )}
      </aside>
      <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center md:min-h-0">
        <div className="card w-full max-w-sm p-8 md:shadow-[0_30px_60px_-30px_rgba(122,3,40,0.35)]">
          <Image src="/images/brand/notesapp-icon.webp" alt="#NotesApp" width={72} height={72} priority className="mx-auto h-[72px] w-[72px] rounded-2xl" />
          <h1 className="mt-5 font-display text-3xl text-ink">Welcome to <span className="text-crimson">NotesApp</span></h1>
          <p className="mt-2 text-sm text-slate">Publish a note, take a booking, get paid in Naira.</p>
          <div className="mt-8 flex min-h-[7rem] w-full flex-col gap-3">
            {signedOut && (
              <>
                <Link href="/signup" className="btn-primary text-center">Create an account</Link>
                <Link href="/login" className="btn-ghost text-center">Sign in</Link>
              </>
            )}
          </div>
          <p className="mt-6 text-xs text-slate">
            By continuing you agree to the{" "}
            <a href={`${MAIN}/terms`} className="underline">Terms</a> and{" "}
            <a href={`${MAIN}/privacy`} className="underline">Privacy Policy</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
