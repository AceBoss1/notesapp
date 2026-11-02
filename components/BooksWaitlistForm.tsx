"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { BUSINESS_TYPES, KEEPS_BOOKS } from "@/lib/books-waitlist";

const field = "mt-2 w-full rounded-lg border border-rule bg-paper px-4 py-3 font-body text-ink outline-none focus:border-crimson";

// The Business books waitlist form on /books. Works for visitors; a signed-in member's name and email are filled in, and the sign-up
// is linked to their account. Goes to /api/books/waitlist and lands on Admin → Leads → Business books waitlist.
export default function BooksWaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [sells, setSells] = useState("");
  const [keepsBooks, setKeepsBooks] = useState("");
  const [otherApp, setOtherApp] = useState("");
  const [city, setCity] = useState("");
  const [notify, setNotify] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<null | { again: boolean }>(null);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (u) { setName((n) => n || u.displayName || ""); setEmail((e) => e || u.email || ""); }
  }), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!businessType) return setError("Choose your kind of business.");
    if (!keepsBooks) return setError("Choose how you keep your books today.");
    setSending(true);
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => undefined);
      const r = await fetch("/api/books/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name, email, businessType, sells, keepsBooks, otherApp, city, notify }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't add you just now. Try again.");
      setSent({ again: !!j.again });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add you just now. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="card p-8 text-center" role="status">
        <p className="font-display text-2xl text-ink">{sent.again ? "Your answers are updated." : "You're on the waitlist."}</p>
        <p className="mt-2 text-sm text-slate">Thank you. We&apos;ve sent a note to {email}.{notify ? " We'll email you when Business books opens." : ""} No date is promised yet: we&apos;re building it with what sellers tell us.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card grid gap-5 p-6 sm:p-7" aria-label="Join the Business books waitlist">
      <div>
        <p className="eyebrow">Waitlist</p>
        <h2 className="mt-2 font-display text-2xl text-ink">Join the waitlist</h2>
        <p className="mt-1 text-sm text-slate">Six quick questions, so we build it for the way you work.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block"><span className="font-ui text-sm font-semibold text-ink">Your name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={field} autoComplete="name" /></label>
        <label className="block"><span className="font-ui text-sm font-semibold text-ink">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} autoComplete="email" /></label>
        <label className="block"><span className="font-ui text-sm font-semibold text-ink">Your kind of business</span>
          <select required value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={field}>
            <option value="">Choose…</option>
            {BUSINESS_TYPES.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select></label>
        <label className="block"><span className="font-ui text-sm font-semibold text-ink">City or town</span>
          <input required value={city} onChange={(e) => setCity(e.target.value)} className={field} placeholder="e.g. Ojota, Lagos" autoComplete="address-level2" /></label>
      </div>
      <label className="block"><span className="font-ui text-sm font-semibold text-ink">What do you sell?</span>
        <input required value={sells} onChange={(e) => setSells(e.target.value)} className={field} placeholder="e.g. rice, garri and Ankara; braids at the back" maxLength={300} /></label>
      <fieldset>
        <legend className="font-ui text-sm font-semibold text-ink">How do you keep your books today?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {KEEPS_BOOKS.map((k) => (
            <button type="button" key={k.id} onClick={() => setKeepsBooks(k.id)} aria-pressed={keepsBooks === k.id}
              className={`rounded-full px-4 py-2 font-ui text-sm font-semibold transition-colors ${keepsBooks === k.id ? "bg-crimson text-paper" : "border border-rule text-ink hover:border-crimson"}`}>
              {k.label}
            </button>
          ))}
        </div>
        {keepsBooks === "other-app" && (
          <input value={otherApp} onChange={(e) => setOtherApp(e.target.value)} className={field} placeholder="Which app?" maxLength={80} aria-label="Which app" />
        )}
      </fieldset>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-1 h-4 w-4 accent-crimson" />
        <span>Email me when Business books opens</span>
      </label>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button type="submit" disabled={sending} className="btn-primary justify-self-start disabled:opacity-60">{sending ? "Adding you…" : "Join the waitlist"}</button>
      <p className="text-xs text-slate">We use your answers only to plan Business books and to tell you when it opens. See our <a href="/privacy" className="text-crimson underline">privacy policy</a>.</p>
    </form>
  );
}
