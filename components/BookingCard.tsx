"use client";

import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { POLICY_TEXT } from "@/lib/cancellation";
import { formatNaira, formatSlot, PublisherSettings } from "@/lib/booking-time";

type Slots = { bookable: boolean; slots: string[]; priceKobo?: number; minutes?: number };

// Books a paid 1:1 session using the PUBLISHER's own rate and
// availability. Renders nothing until the publisher has switched
// sessions on in /profile/publishing.
export default function BookingCard({
  username,
  publisherUid,
  viewer,
}: {
  username: string;
  publisherUid?: string;
  viewer: User | null | undefined;
}) {
  const [offered, setOffered] = useState<PublisherSettings["session"] | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slots | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publisherUid) return;
    getDoc(doc(db, "publisherSettings", publisherUid))
      .then((snap) => {
        const s = (snap.data() as PublisherSettings | undefined)?.session;
        setOffered(s?.enabled ? s : null);
      })
      .catch(() => setOffered(null));
  }, [publisherUid]);

  useEffect(() => {
    setSlot(null);
    setSlots(null);
    if (!date) return;
    fetch(`/api/booking/slots?username=${encodeURIComponent(username)}&date=${date}`)
      .then((r) => r.json())
      .then(setSlots)
      .catch(() => setSlots({ bookable: false, slots: [] }));
  }, [date, username]);

  if (!offered || viewer?.uid === publisherUid) return null;

  async function pay() {
    setError(null);
    if (!viewer) return setError("Sign in to book a session.");
    if (!date || !slot) return setError("Pick a date and a time.");
    setBusy(true);
    try {
      await startCheckout(viewer, { kind: "booking", username, date, slot });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start payment.");
      setBusy(false);
    }
  }

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="card mt-12 p-7">
      <p className="eyebrow">Native booking calendar</p>
      <h2 className="mt-2 font-display text-2xl text-ink">Book a 1:1 session</h2>
      <p className="mt-2 text-sm text-slate">
        {offered.minutes} minutes · {formatNaira(offered.priceKobo)} · times shown in Lagos time (WAT).
      </p>
      <input
        type="date"
        value={date}
        min={tomorrow}
        onChange={(e) => setDate(e.target.value)}
        className="mt-6 rounded-xl2 border border-rule bg-paper px-4 py-2 font-ui text-sm text-ink"
        aria-label="Session date"
      />
      {date && slots && slots.slots.length === 0 && (
        <p className="mt-4 text-sm text-slate">No times available on that date — try another day.</p>
      )}
      {slots && slots.slots.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {slots.slots.map((s) => (
            <button
              key={s}
              onClick={() => setSlot(s)}
              className={`rounded-xl2 border px-4 py-3 font-ui text-sm font-semibold transition-colors ${
                slot === s
                  ? "border-crimson bg-crimson text-paper"
                  : "border-rule text-ink hover:border-crimson hover:text-crimson"
              }`}
            >
              {formatSlot(s)}
            </button>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-slate">{POLICY_TEXT}</p>
      {slot && (
        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl2 border border-rule bg-paper p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-ui text-sm font-semibold text-ink">
              {date} · {formatSlot(slot)} · {offered.minutes} min
            </p>
            <p className="font-mono text-xs text-slate">{formatNaira(offered.priceKobo)} · secure checkout via Paystack</p>
            {error && <p className="mt-1 text-xs text-crimson">{error}</p>}
          </div>
          <button onClick={pay} disabled={busy} className="btn-primary !px-5 !py-2 text-xs disabled:opacity-50">
            {busy ? "Redirecting…" : "Confirm & pay"}
          </button>
        </div>
      )}
      {!slot && error && <p className="mt-3 text-xs text-crimson">{error}</p>}
    </div>
  );
}
