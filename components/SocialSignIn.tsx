"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { continueWithGoogle, googleRedirectResult, linkedinAvailable, linkedinReturn, startLinkedIn, type SocialOutcome } from "@/lib/social-auth-client";
import { SOCIAL_LABEL } from "@/lib/social-auth";

export const GoogleMark = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
  </svg>
);
export const LinkedInMark = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="4" fill="#0A66C2" />
    <path fill="#fff" d="M7.1 9.5H4.6V19h2.5V9.5zM5.9 5a1.45 1.45 0 100 2.9 1.45 1.45 0 000-2.9zM19.4 13.6c0-2.6-1.4-4.3-3.7-4.3-1.2 0-2.1.6-2.5 1.3V9.5h-2.4V19h2.5v-4.9c0-1.3.5-2.2 1.6-2.2s1.5.9 1.5 2.2V19h2.5l.5-5.4z" />
  </svg>
);

const btn = "flex w-full items-center justify-center gap-3 rounded-full border border-rule bg-card px-6 py-3 font-ui font-semibold text-ink transition-colors hover:border-crimson disabled:opacity-50";

// "Continue with Google" and "Continue with LinkedIn" (when LinkedIn is set up) for the sign-in and sign-up forms. A returning
// account signs straight in; a new one goes on to the new-account steps (`onSignedIn(user, needsProfile)`); an email that already
// has an account is never merged: the person is asked to sign in to it first and link the new way from Account settings.
// `afterPassword` says whether the form beside it can sign in with a password right now (the login form), so Google can be linked
// the moment they do.
export default function SocialSignIn({ onSignedIn, verb = "Continue", afterPassword = false, divider = false, className = "" }: {
  onSignedIn: (user: User, needsProfile: boolean) => Promise<void> | void;
  verb?: "Continue" | "Sign up";
  afterPassword?: boolean;
  divider?: boolean; // an "or" line above the buttons
  className?: string;
}) {
  const [linkedin, setLinkedin] = useState(false);
  const [busy, setBusy] = useState<"" | "google" | "linkedin">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<SocialOutcome & { kind: "link-required" } | null>(null);
  const done = useRef(onSignedIn);
  done.current = onSignedIn;

  async function handle(p: Promise<SocialOutcome | null>, which: "google" | "linkedin") {
    setBusy(which); setError(""); setNotice(null);
    try {
      const r = await p;
      if (!r || r.kind === "redirecting") return;
      if (r.kind === "link-required") { setNotice(r); return; }
      if (r.kind === "signed-in") await done.current(r.user, r.needsProfile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy((b) => (b === which ? "" : b));
    }
  }

  // On load: LinkedIn availability, and coming back from a Google redirect or from LinkedIn.
  useEffect(() => {
    linkedinAvailable().then(setLinkedin);
    if (/^#li(_error)?=/.test(window.location.hash)) void handle(linkedinReturn(), "linkedin");
    else void handle(googleRedirectResult(), "google");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={className}>
      {divider && <div className="mb-4 flex items-center gap-3 text-xs text-slate" aria-hidden="true"><span className="h-px flex-1 bg-rule" />or<span className="h-px flex-1 bg-rule" /></div>}
      <div className="grid gap-3">
        <button type="button" onClick={() => handle(continueWithGoogle(), "google")} disabled={!!busy} className={btn}>
          <GoogleMark /> {busy === "google" ? "Waiting for Google…" : `${verb} with Google`}
        </button>
        {linkedin && (
          <button type="button" onClick={() => { setBusy("linkedin"); setError(""); startLinkedIn("signin").catch((e) => { setBusy(""); setError(e instanceof Error ? e.message : "Couldn't open LinkedIn"); }); }} disabled={!!busy} className={btn}>
            <LinkedInMark /> {busy === "linkedin" ? "Opening LinkedIn…" : `${verb} with LinkedIn`}
          </button>
        )}
      </div>
      {notice && (
        <div className="mt-3 rounded-xl border border-gold/60 bg-gold/10 p-3 text-sm text-ink" role="alert">
          <p className="font-semibold">You already have a #NotesApp account{notice.email ? ` with ${notice.email}` : ""}.</p>
          <p className="mt-1 text-slate">
            {notice.canLinkAfterPassword && afterPassword
              ? `Sign in with your password below and we'll link ${SOCIAL_LABEL[notice.provider]} to it, so next time ${SOCIAL_LABEL[notice.provider]} signs you in.`
              : notice.hasOtherWay === false
              ? `To keep your account safe we didn't sign you in with ${SOCIAL_LABEL[notice.provider]}. Reset your password by email (Forgot password?), sign in, then link ${SOCIAL_LABEL[notice.provider]} in Account settings → Sign-in methods.`
              : `To keep your account safe we don't join accounts on our own. Sign in the way you usually do (password or passkey), then link ${SOCIAL_LABEL[notice.provider]} in Account settings → Sign-in methods.`}
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
