"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureAdminProfile } from "@/lib/users";
import { goBack } from "@/lib/return-to";
import PageHero from "@/components/PageHero";
import { sendPasswordResetEmail } from "firebase/auth";
import PasswordInput from "@/components/PasswordInput";

// The sign-in form (with a forgot-password step). `embedded` drops the page header and padding so it fits inside a card (the app address's welcome screen), signs in
// there and carries on to the journal; `onSwitch` swaps "Create an account" for an in-place switch.
export default function LoginForm({ embedded = false, onSwitch }: { embedded?: boolean; onSwitch?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (embedded && new URLSearchParams(window.location.search).get("auth") === "forgot") setForgot(true); }, [embedded]);
  // Where to go after signing in on the app address: the page it was asked from (?next=…) or the journal.
  const nextPath = () => { const n = new URLSearchParams(window.location.search).get("next") || ""; return n.startsWith("/") && !n.startsWith("//") ? n : "/journals"; };
  // Already signed in here and sent over from a member's own site? Carry on straight back to it.
  useEffect(() => onAuthStateChanged(auth, (u) => { if (u) goBack(u); }), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureAdminProfile(cred.user); // no-op for regular readers
      if (!(await goBack(cred.user))) router.push(embedded ? nextPath() : "/"); // came from a member's own domain? sign in there and go back
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(
        code === "auth/too-many-requests"
          ? "Too many attempts. Reset your password or try again in a few minutes."
          : code === "auth/network-request-failed"
          ? "Network problem — check your connection and try again."
          : "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found") setSent(true); // same message as success: don't reveal which emails have accounts
      else if (code === "auth/too-many-requests") setError("Too many attempts. Please wait a few minutes and try again.");
      else if (code === "auth/invalid-email") setError("That doesn't look like a valid email address.");
      else setError("Couldn't send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (embedded && forgot) {
    return (
      <section className="text-left">
        <p className="eyebrow">Account</p>
        <h2 className="mt-1 font-display text-2xl text-ink">Reset your password</h2>
        {sent ? (
          <p className="mt-4 text-sm text-slate">If an account exists for <span className="text-ink">{email}</span>, a reset link is on its way. Check your spam folder too; the link expires after an hour.</p>
        ) : (
          <form onSubmit={handleReset} className="mt-4 grid gap-4">
            <label className="block">
              <span className="eyebrow">Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none" />
            </label>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={loading} className="rounded-full bg-crimson px-6 py-3 font-ui font-semibold text-paper transition-colors hover:bg-crimson-deep disabled:opacity-50">{loading ? "Sending…" : "Send the link"}</button>
          </form>
        )}
        <p className="mt-4 text-sm"><button type="button" onClick={() => { setForgot(false); setSent(false); setError(""); }} className="font-semibold text-crimson-bright">Back to sign in</button></p>
      </section>
    );
  }

  return (
    <>
      {!embedded && <PageHero compact max="max-w-sm" eyebrow="Welcome Back" title={<>Sign in</>} />}
      <section className={embedded ? "text-left" : "mx-auto max-w-sm px-4 py-10"}>
      <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
        <label className="block">
          <span className="eyebrow">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Password</span>
          <PasswordInput
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-crimson text-paper font-ui font-semibold px-6 py-3 hover:bg-crimson-deep hover:text-paper transition-colors disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        {embedded ? (
          <button type="button" onClick={() => { setForgot(true); setError(""); }} className="text-crimson-bright font-semibold">Forgot password?</button>
        ) : (
          <a href="/forgot-password" className="text-crimson-bright font-semibold">Forgot password?</a>
        )}
      </p>
      <p className="mt-4 text-sm text-slate">
        New here?{" "}
        {onSwitch ? (
          <button type="button" onClick={onSwitch} className="text-crimson-bright font-semibold">Create an account</button>
        ) : (
          <a href="/signup" className="text-crimson-bright font-semibold">Create an account</a>
        )}
      </p>
    </section>
    </>
  );
}
