"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { FEEDBACK_TEXT_MAX, MOOD_SCALE } from "@/lib/feedback";

const field = "mt-2 w-full border border-rule bg-paper px-4 py-3 font-body focus:border-crimson outline-none";

// The one-month feedback form (/contact?topic=feedback, or Feedback in the contact form's list). Works for visitors; a signed-in
// member's name and email are filled in, and the reply is linked to their account. Lands on Admin → Leads → Feedback.
export default function FeedbackForm({ onBack }: { onBack?: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [love, setLove] = useState("");
  const [missing, setMissing] = useState("");
  const [recommend, setRecommend] = useState<number | null>(null);
  const [contactOk, setContactOk] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setSignedIn(!!u);
    if (u) { setName((n) => n || u.displayName || ""); setEmail((e) => e || u.email || ""); }
  }), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mood === null) return setError("Choose how your first month has been.");
    if (recommend === null) return setError("Choose how likely you are to recommend us, from 0 to 10.");
    if (contactOk === null) return setError("Can we contact you about your answers? Choose yes or no.");
    setSending(true);
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => undefined);
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name, email, mood, love, missing, recommend, contactOk }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't send that. Try again.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="card mt-8 p-8 text-center">
        <p className="font-display text-2xl text-ink">Thank you.</p>
        <p className="mt-2 text-sm text-slate">Your feedback has gone straight to the team. We read every reply{contactOk ? `, and may write to you at ${email}` : ""}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card mt-8 grid gap-6 p-7" aria-label="One-month feedback">
      <div>
        <p className="eyebrow">Feedback · our first month</p>
        <h2 className="mt-2 font-display text-2xl text-ink">How&apos;s #NotesApp so far?</h2>
        <p className="mt-1 text-sm text-slate">Five quick questions. It takes about two minutes.{onBack && <> <button type="button" onClick={onBack} className="text-crimson underline">Send a message instead</button>.</>}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={field} autoComplete="name" />
        </label>
        <label className="block">
          <span className="eyebrow">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} autoComplete="email" />
        </label>
      </div>
      {signedIn && <p className="-mt-3 text-xs text-slate">Filled in from your account. Your reply is linked to it, so we know who it&apos;s from.</p>}

      <fieldset>
        <legend className="eyebrow">1. How has your first month been?</legend>
        <div className="mt-3 grid grid-cols-5 gap-2" role="radiogroup">
          {MOOD_SCALE.map((m) => (
            <button key={m.value} type="button" role="radio" aria-checked={mood === m.value} onClick={() => setMood(m.value)}
              className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-3 transition-colors ${mood === m.value ? "border-crimson bg-crimson/10" : "border-rule hover:border-crimson"}`}>
              <span className="text-2xl sm:text-3xl" aria-hidden>{m.emoji}</span>
              <span className="text-[11px] font-semibold text-ink sm:text-xs">{m.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="eyebrow">2. What do you love?</span>
        <textarea rows={3} maxLength={FEEDBACK_TEXT_MAX} value={love} onChange={(e) => setLove(e.target.value)} className={field} placeholder="A feature, a page, something that worked well for you" />
      </label>

      <label className="block">
        <span className="eyebrow">3. What&apos;s missing or broken?</span>
        <textarea rows={3} maxLength={FEEDBACK_TEXT_MAX} value={missing} onChange={(e) => setMissing(e.target.value)} className={field} placeholder="Something you looked for and couldn't find, or something that didn't work" />
      </label>

      <fieldset>
        <legend className="eyebrow">4. How likely are you to recommend #NotesApp to a friend?</legend>
        <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-11" role="radiogroup">
          {Array.from({ length: 11 }, (_, n) => (
            <button key={n} type="button" role="radio" aria-checked={recommend === n} onClick={() => setRecommend(n)}
              className={`rounded-md border py-2 font-ui text-sm font-semibold transition-colors ${recommend === n ? "border-crimson bg-crimson text-paper" : "border-rule text-ink hover:border-crimson"}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-slate"><span>0 · Not likely</span><span>10 · Very likely</span></div>
      </fieldset>

      <fieldset>
        <legend className="eyebrow">5. Can we contact you about your answers?</legend>
        <div className="mt-3 flex gap-2">
          {([[true, "Yes"], [false, "No"]] as const).map(([v, label]) => (
            <button key={label} type="button" role="radio" aria-checked={contactOk === v} onClick={() => setContactOk(v)}
              className={`rounded-full border px-6 py-2 font-ui text-sm font-semibold ${contactOk === v ? "border-crimson bg-crimson text-paper" : "border-rule text-ink hover:border-crimson"}`}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={sending} className="bg-crimson text-paper font-ui font-semibold px-6 py-3 hover:bg-crimson-bright transition-colors disabled:opacity-50">
        {sending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
