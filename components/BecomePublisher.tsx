"use client";

import { useState } from "react";
import Link from "next/link";
import { User } from "firebase/auth";
import { UserProfile } from "@/lib/users";

// Shown on Rates & payouts to accounts that can't publish yet (Free
// Standard): apply for Free Basic (admin-reviewed) or pick a paid plan.
export default function BecomePublisher({ user, profile, onApplied }: { user: User | null; profile: UserProfile | null; onApplied: () => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const req = profile?.tierRequest;

  async function apply() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tier-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't submit");
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Rates &amp; payouts</p>
      <h1 className="mt-3 font-display text-3xl text-ink">Start publishing to start earning</h1>
      <p className="mt-3 text-sm text-slate">
        Free Standard accounts read, comment, book and buy. To publish journals, set your own session and subscription
        prices and get paid, you need a publishing plan:
      </p>

      <div className="card mt-6 p-6">
        <p className="font-ui text-base font-bold text-ink">Free Basic — apply, reviewed by an admin</p>
        <p className="mt-1 text-sm text-slate">No payment. NotesApp takes 35% of what you earn through sessions, subscriptions and gifts.</p>
        {req?.status === "pending" ? (
          <p className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-ink">
            Your application is waiting for review. You'll get a notification when it's decided.
          </p>
        ) : (
          <>
            {req?.status === "rejected" && (
              <p className="mt-4 border border-rule px-3 py-2 text-sm text-slate">Your last application wasn't approved. You can apply again with more detail.</p>
            )}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="What would you like to publish or offer? (a sentence or two)"
              className="mt-4 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson"
            />
            <button onClick={apply} disabled={busy || !user} className="btn-primary mt-3 !px-5 !py-2 text-xs disabled:opacity-50">
              {busy ? "Sending…" : "Apply for Free Basic"}
            </button>
            {error && <p className="mt-2 text-xs text-crimson">{error}</p>}
          </>
        )}
      </div>

      <div className="card mt-4 p-6">
        <p className="font-ui text-base font-bold text-ink">Pro or Business — start right away</p>
        <p className="mt-1 text-sm text-slate">Paid plans with lower commission; publishing is enabled the moment payment succeeds.</p>
        <Link href="/pricing" className="mt-3 inline-block text-sm text-crimson underline underline-offset-2">
          Compare plans →
        </Link>
      </div>
    </section>
  );
}
