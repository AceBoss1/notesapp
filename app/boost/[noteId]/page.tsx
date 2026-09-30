"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getNoteById, Note } from "@/lib/firestore-notes";
import { BOOST_PACKAGES } from "@/lib/boost-config";
import { startCheckout } from "@/lib/checkout";
import { formatNaira } from "@/lib/booking-time";

export default function BoostPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [note, setNote] = useState<Note | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (!u) return router.replace("/login");
        setUser(u);
        getNoteById(noteId).then(setNote).catch(() => setNote(null));
      }),
    [noteId, router]
  );

  async function pay(packageId: string) {
    if (!user) return;
    setBusy(packageId);
    setError("");
    try {
      await startCheckout(user, { kind: "boost", noteId, packageId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start payment.");
      setBusy(null);
    }
  }

  if (note === undefined) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!note) return <div className="px-6 py-24 text-center text-slate">Post not found.</div>;

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <span className="eyebrow">Boost</span>
      <h1 className="mt-3 font-display text-3xl text-ink">Boost “{note.title}”</h1>
      {note.status !== "published" && (
        <p className="mt-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink">
          Publish this post first — only published posts can be boosted.
        </p>
      )}
      <p className="mt-3 text-sm text-slate">
        A boost puts your post in the “Boosted posts” slot on the home page and Journals page. You pay for{" "}
        <strong className="text-ink">validated impressions</strong>: a real visitor seeing your card on screen for about a
        second, counted once per visitor per day (bots and your own views excluded). Delivery is capped per day so it spreads
        over several days, and any impressions not delivered by the end of the window are refunded pro-rata.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {BOOST_PACKAGES.map((p) => (
          <div key={p.id} className="card flex flex-col p-6">
            <p className="font-ui text-base font-bold text-ink">{p.name}</p>
            <p className="mt-2 font-display text-2xl text-ink">{formatNaira(p.priceKobo)}</p>
            <ul className="mt-3 flex-1 space-y-1 text-sm text-slate">
              <li>{p.impressions.toLocaleString()} impressions</li>
              <li>Up to {p.maxPerDay.toLocaleString()}/day</li>
              <li>Runs up to {p.windowDays} days</li>
              <li className="font-mono text-xs">₦{(p.priceKobo / 100 / (p.impressions / 1000)).toLocaleString()} per 1,000</li>
            </ul>
            <button
              onClick={() => pay(p.id)}
              disabled={!!busy || note.status !== "published"}
              className="btn-primary mt-5 !px-5 !py-2 text-xs disabled:opacity-50"
            >
              {busy === p.id ? "Redirecting…" : "Boost with Paystack"}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      <p className="mt-6 text-xs text-slate">
        <Link href="/admin/notes" className="underline">Back to your posts</Link>
      </p>
    </section>
  );
}
