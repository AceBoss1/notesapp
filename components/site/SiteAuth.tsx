"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { signUpProfile, isUsernameTaken } from "@/lib/users";
import { followJournal } from "@/lib/follows";
import { MANDATORY_JOURNALS, isReservedUsername } from "@/lib/journals-directory";
import { useSite } from "./SiteContext";

// Sign-in and sign-up on an Enterprise member's own domain (full white label): a window in the member's name and logo,
// over their own site. It still says plainly that it is a NotesApp account, but nothing else about it is #NotesApp's: the
// form is here, the emails come in the member's name (app/api/auth/branded) and their links open here too.
type Mode = "signin" | "signup" | "forgot";
const Ctx = createContext<{ open: (m: Mode) => void } | null>(null);
export const useSiteAuth = () => useContext(Ctx);

const normalizeUsername = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);

export function SiteAuthProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);
  // Arrived through /login, /signup or /forgot-password (middleware rewrites those to the home page with ?auth=…)?
  // Then closing, or signing in, carries on to the page the visitor came from.
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const m = q.get("auth");
    if (m === "signin" || m === "signup" || m === "forgot") {
      let next = q.get("next") || "/";
      if (!next.startsWith("/") || next.startsWith("//")) next = "/";
      setMode(m);
      setLeaveTo(next);
    }
  }, []);
  const done = useCallback(() => {
    setMode(null);
    if (leaveTo) window.location.assign(leaveTo);
  }, [leaveTo]);
  const open = useCallback((m: Mode) => setMode(m), []);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {mode && <AuthModal mode={mode} setMode={setMode} onDone={done} onClose={done} />}
    </Ctx.Provider>
  );
}

function AuthModal({ mode, setMode, onDone, onClose }: { mode: Mode; setMode: (m: Mode) => void; onDone: () => void; onClose: () => void }) {
  const site = useSite();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentVerify, setSentVerify] = useState(false);
  const [welcome, setWelcome] = useState(false); // after sign-up: a short confirmation before carrying on

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const switchTo = (m: Mode) => { setError(""); setNote(""); setMode(m); };

  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await signInWithEmailAndPassword(auth, email, password); onDone(); }
    catch (err) {
      const code = (err as { code?: string }).code;
      setError(code === "auth/too-many-requests" ? "Too many attempts. Reset your password or try again in a few minutes." : code === "auth/network-request-failed" ? "Network problem. Check your connection and try again." : "That email and password don't match a NotesApp account.");
    } finally { setBusy(false); }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const clean = normalizeUsername(username);
    if (!agreed) return setError("Please accept the Terms and Privacy Policy to continue.");
    if (clean.length < 3) return setError("Username must be at least 3 characters (letters, numbers, _).");
    if (isReservedUsername(clean)) return setError("That username isn't available.");
    setBusy(true);
    try {
      if (await isUsernameTaken(clean)) { setError("That username is already taken."); return; }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await signUpProfile({ uid: cred.user.uid, email, username: clean, displayName: displayName || clean });
      // Same starting follows as every new account, plus this site's owner.
      await Promise.all([...MANDATORY_JOURNALS.map((j) => followJournal(cred.user.uid, j.username, true)), followJournal(cred.user.uid, site.username, false)]).catch(() => {});
      // The confirmation email comes in the member's name; failing to send it never blocks sign-up (it can be asked for again).
      fetch("/api/auth/branded", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await cred.user.getIdToken()}` }, body: JSON.stringify({ kind: "verify" }) })
        .then((r) => setSentVerify(r.ok)).catch(() => {});
      setWelcome(true);
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(code === "auth/email-already-in-use" ? "That email already has a NotesApp account. Sign in instead." : code === "auth/weak-password" ? "Choose a password of at least 6 characters." : err instanceof Error && err.message.includes("username") ? err.message : "Something went wrong. Try again.");
    } finally { setBusy(false); }
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await fetch("/api/auth/branded", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "reset", email }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't send that.");
      setNote("If that email has a NotesApp account, a link to choose a new password is on its way.");
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't send that."); }
    finally { setBusy(false); }
  }

  const field = "mt-2 w-full border border-rule bg-card px-4 py-3 outline-none focus:border-crimson";
  const title = mode === "signin" ? "Sign in with a NotesApp account" : mode === "signup" ? "Sign up with a NotesApp account" : "Reset your password";
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative my-8 w-full max-w-sm bg-paper p-7 shadow-xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-2 px-2 text-2xl leading-none text-slate">×</button>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={site.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
          <p className="font-ui text-base font-extrabold text-ink">{site.displayName}</p>
        </div>
        <h2 className="mt-5 font-display text-2xl text-ink">{welcome ? "Welcome" : title}</h2>
        {!welcome && mode !== "forgot" && <p className="mt-1 text-xs text-slate">{mode === "signin" ? `Use your NotesApp account to sign in to ${site.displayName}.` : `Create a NotesApp account to book, buy and follow on ${site.displayName}. It works on every site powered by NotesApp.`}</p>}
        {welcome && (
          <div className="mt-5">
            <p className="text-sm text-ink">You&apos;re in. Your NotesApp account is ready.</p>
            <p className="mt-2 text-sm text-slate">{sentVerify ? "We've emailed you a link to confirm your address." : "We'll email you a link to confirm your address."}</p>
            <button onClick={onDone} className="btn-primary mt-5 w-full">Continue</button>
          </div>
        )}

        {!welcome && mode === "signin" && (
          <form onSubmit={signIn} className="mt-5 grid gap-4">
            <label className="block"><span className="eyebrow">Email</span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} /></label>
            <label className="block"><span className="eyebrow">Password</span><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} /></label>
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <button disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
            <p className="text-xs text-slate"><button type="button" onClick={() => switchTo("forgot")} className="underline">Forgot your password?</button> Signed up with Google? Choose that to set a password for your NotesApp account.</p>
            <p className="text-sm text-slate">New here? <button type="button" onClick={() => switchTo("signup")} className="font-semibold text-crimson underline">Sign up with a NotesApp account</button></p>
          </form>
        )}

        {!welcome && mode === "signup" && (
          <form onSubmit={signUp} className="mt-5 grid gap-4">
            <label className="block"><span className="eyebrow">Your name</span><input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" className={field} /></label>
            <label className="block"><span className="eyebrow">Username</span>
              <span className="mt-2 flex items-center border border-rule bg-card focus-within:border-crimson"><span className="pl-4 font-mono text-slate">@</span><input required value={username} onChange={(e) => setUsername(normalizeUsername(e.target.value))} className="w-full bg-transparent px-2 py-3 font-mono outline-none" /></span>
            </label>
            <label className="block"><span className="eyebrow">Email</span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} /></label>
            <label className="block"><span className="eyebrow">Password</span><input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} /></label>
            <label className="flex items-start gap-3 text-xs text-slate">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
              <span>I&apos;m 18 or older and agree to the <a href="/terms" target="_blank" className="underline">Terms</a> and <a href="/privacy" target="_blank" className="underline">Privacy Policy</a>.</span>
            </label>
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <button disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "Creating your account…" : "Sign up"}</button>
            <p className="text-sm text-slate">Already have one? <button type="button" onClick={() => switchTo("signin")} className="font-semibold text-crimson underline">Sign in with a NotesApp account</button></p>
          </form>
        )}

        {!welcome && mode === "forgot" && (
          <form onSubmit={forgot} className="mt-5 grid gap-4">
            <p className="text-xs text-slate">Enter the email of your NotesApp account and we&apos;ll send you a link to choose a new password.</p>
            <label className="block"><span className="eyebrow">Email</span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} /></label>
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            {note && <p className="text-sm text-slate" role="status">{note}</p>}
            <button disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "Sending…" : "Send the link"}</button>
            <p className="text-sm text-slate"><button type="button" onClick={() => switchTo("signin")} className="font-semibold text-crimson underline">Back to sign in</button></p>
          </form>
        )}
      </div>
    </div>
  );
}
