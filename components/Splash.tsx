"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { MAIN_HOST } from "@/lib/host";

// A full-screen welcome: the logo and two buttons. Someone already signed in never sees the buttons; they go to their journal.
export default function Splash() {
  const router = useRouter();
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/journals");
      else setSignedOut(true);
    });
  }, [router]);

  return (
    <div className="md:grid md:min-h-screen md:grid-cols-2">
      {/* Tablet and desktop: the left half repeats the brand on the same gradient as the challenge hero. */}
      <aside className="hidden flex-col items-center justify-center border-r border-rule bg-gradient-to-b from-crimson/10 via-white to-white px-10 text-center md:flex" aria-hidden>
        <Image src="/images/brand/notesapp-icon.webp" alt="" width={128} height={128} className="h-32 w-32 rounded-3xl shadow-md" />
        <p className="mt-8 font-ui text-5xl font-extrabold tracking-tight text-ink">
          Notes<span className="text-crimson">App</span>
        </p>
        <p className="mt-4 max-w-sm text-lg text-slate">Publish a note, take a booking, get paid.</p>
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
