"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { MAIN_HOST } from "@/lib/host";
import { challengePromoActive } from "@/lib/challenge-promo";
import ChallengePanel from "@/components/ChallengePanel";
import LoginForm from "@/components/LoginForm";
import SignupFlow from "@/components/SignupFlow";

const MAIN = `https://${MAIN_HOST}`;

// The welcome screen of the app address: on a wide screen the challenge announcement in crimson on the left and, on the right, the sign-in and sign-up forms
// themselves (no pop-up, no trip to another page: this address handles them on its own); on a phone just the card. Someone already signed in goes to their journal
// (or the page they were sent from). /login, /signup and /forgot-password on this address land here (middleware).
export default function Splash() {
  const router = useRouter();
  const [signedOut, setSignedOut] = useState(false);
  const [view, setView] = useState<"signin" | "signup">("signin");
  const [onboarding, setOnboarding] = useState(false); // the account is being made: don't redirect until the follow step is done
  const hold = useRef(false);
  const [promo, setPromo] = useState<boolean | null>(null); // decided in an effect so server and browser render the same first
  useEffect(() => setPromo(challengePromoActive()), []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("auth") === "signup") setView("signup");
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) {
        if (hold.current) return;
        const n = new URLSearchParams(window.location.search).get("next") || "";
        router.replace(n.startsWith("/") && !n.startsWith("//") ? n : "/journals");
      } else setSignedOut(true);
    });
  }, [router]);

  const top = (
    <div className="relative flex items-center justify-between px-6 pt-6 lg:px-8">
      <span className="flex items-center gap-2.5">
        <Image src="/images/brand/notesapp-icon.webp" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
        <span className="font-ui text-xl font-extrabold tracking-tight text-paper">Notes<span className="text-[#FFB3C6]">App</span></span>
      </span>
      <nav className="flex items-center gap-5 font-ui text-sm font-semibold text-paper/90" aria-label="More about #NotesApp">
        <Link href="/install" className="rounded-full border border-paper/50 px-3.5 py-1.5 hover:bg-paper/10">📱 Download on mobile</Link>
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
        <div className={`card w-full p-8 md:shadow-[0_30px_60px_-30px_rgba(122,3,40,0.35)] ${view === "signup" ? "max-w-md" : "max-w-sm"}`}>
          <Image src="/images/brand/notesapp-icon.webp" alt="#NotesApp" width={72} height={72} priority className="mx-auto h-[72px] w-[72px] rounded-2xl" />
          <h1 className="mt-5 font-display text-3xl text-ink">Welcome to <span className="text-crimson">NotesApp</span></h1>
          <p className="mt-2 text-sm text-slate">Publish a note, take a booking, get paid in Naira.</p>
          <div className="mt-6 min-h-[7rem] w-full">
            {signedOut && (
              <>
                {!onboarding && (
                  <div role="tablist" aria-label="Sign in or create an account" className="mb-6 grid grid-cols-2 overflow-hidden rounded-full border border-rule text-sm font-semibold">
                    {([["signin", "Sign in"], ["signup", "Create account"]] as const).map(([k, l]) => (
                      <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`px-4 py-2 ${view === k ? "bg-crimson text-paper" : "text-ink hover:text-crimson"}`}>{l}</button>
                    ))}
                  </div>
                )}
                {view === "signin" ? (
                  <LoginForm embedded onSwitch={() => setView("signup")} />
                ) : (
                  <SignupFlow embedded onSwitch={() => setView("signin")} onStarted={() => { hold.current = true; setOnboarding(true); }} />
                )}
              </>
            )}
          </div>
          <p className="mt-6 text-xs text-slate">
            By continuing you agree to the{" "}
            <a href={`${MAIN}/terms`} className="underline">Terms</a> and{" "}
            <a href={`${MAIN}/privacy`} className="underline">Privacy Policy</a>.
          </p>
          <p className="mt-3 text-xs md:hidden"><Link href="/install" className="font-semibold text-crimson underline">Install NotesApp on your phone</Link></p>
        </div>
      </main>
    </div>
  );
}
