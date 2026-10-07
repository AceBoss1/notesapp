"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useSite } from "@/components/site/SiteContext";

// The page behind the links in the emails sent from a member's own domain (password reset, email confirmation): the whole thing
// happens here, under the member's name.
function Action() {
  const q = useSearchParams();
  const site = useSite();
  const mode = q.get("mode");
  const code = q.get("oobCode") || "";
  const [state, setState] = useState<"working" | "ready" | "done" | "bad">("working");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return setState("bad");
    if (mode === "verifyEmail") {
      applyActionCode(auth, code).then(() => auth.currentUser?.reload()).then(() => setState("done")).catch(() => setState("bad"));
    } else if (mode === "resetPassword") {
      verifyPasswordResetCode(auth, code).then(() => setState("ready")).catch(() => setState("bad"));
    } else setState("bad");
  }, [mode, code]);

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await confirmPasswordReset(auth, code, password); setState("done"); }
    catch { setError("That link has expired or was already used. Ask for a new one."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-20 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={site.avatar} alt="" className="mx-auto h-14 w-14 rounded-full object-cover" />
      <p className="mt-3 font-ui text-sm font-bold text-ink">{site.displayName}</p>
      {state === "working" && <p className="mt-8 text-sm text-slate">One moment…</p>}
      {state === "bad" && (
        <>
          <p className="mt-8 font-display text-2xl text-ink">This link doesn&apos;t work</p>
          <p className="mt-2 text-sm text-slate">It may have expired or been used already. Go back and ask for a new one.</p>
          <a href={mode === "resetPassword" ? "/forgot-password" : "/"} className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">{mode === "resetPassword" ? "Ask for a new link" : "Back to the site"}</a>
        </>
      )}
      {state === "ready" && (
        <form onSubmit={reset} className="mt-8 text-left">
          <p className="text-center font-display text-2xl text-ink">Choose a new password</p>
          <label className="mt-5 block">
            <span className="eyebrow">New password</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full border border-rule bg-card px-4 py-3 outline-none focus:border-crimson" />
          </label>
          {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
          <button disabled={busy} className="btn-primary mt-5 w-full disabled:opacity-50">{busy ? "Saving…" : "Save password"}</button>
        </form>
      )}
      {state === "done" && (
        <>
          <p className="mt-8 font-display text-2xl text-ink">{mode === "verifyEmail" ? "Your email is confirmed" : "Your password is saved"}</p>
          <p className="mt-2 text-sm text-slate">{mode === "verifyEmail" ? "Thank you." : "You can sign in with your NotesApp account now."}</p>
          <a href={mode === "verifyEmail" ? "/" : "/login"} className="btn-primary mt-6 inline-block !px-5 !py-2 text-xs">{mode === "verifyEmail" ? "Continue" : "Sign in"}</a>
        </>
      )}
    </div>
  );
}

export default function ActionPage() {
  return <Suspense fallback={null}><Action /></Suspense>;
}
