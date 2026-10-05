"use client";

import { useEffect, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Redeems the one-time token from www.notesapp.name.ng/api/auth/handoff, so the visitor is signed in on this domain too,
// then sends them on to the page they were on. The token is in the URL fragment and is removed from the address at once.
export default function Handoff() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = h.get("t");
    let next = h.get("next") || "/";
    if (!next.startsWith("/") || next.startsWith("//")) next = "/";
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) return void window.location.replace(next);
    signInWithCustomToken(auth, token)
      .then(() => window.location.replace(next))
      .catch(() => setFailed(true));
  }, []);
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      {failed ? (
        <>
          <p className="font-display text-2xl text-ink">We couldn&apos;t sign you in here</p>
          <p className="mt-3 text-sm text-slate">The sign-in link expired. Go back and press Sign in again.</p>
          <a href="/" className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">Back to the site</a>
        </>
      ) : (
        <p className="text-sm text-slate">Signing you in…</p>
      )}
    </div>
  );
}
