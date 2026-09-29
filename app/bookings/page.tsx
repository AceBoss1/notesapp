"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { formatNaira, formatSlot } from "@/lib/booking-time";
import { POLICY_TEXT, refundFraction } from "@/lib/cancellation";

type Booking = {
  reference: string;
  username: string;
  date: string;
  slot: string;
  minutes: number;
  amountKobo: number;
  startsAt: string;
  status: string;
  clientUid: string;
  clientEmail: string;
  publisherUid: string;
  refundKobo?: number;
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  cancelling: "Cancelling…",
  cancelled_by_client: "Cancelled by client",
  cancelled_by_publisher: "Cancelled by publisher",
  refunded: "Refunded",
};

export default function BookingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load(u: User) {
    const [asClient, asPublisher] = await Promise.all([
      getDocs(query(collection(db, "bookings"), where("clientUid", "==", u.uid))),
      getDocs(query(collection(db, "bookings"), where("publisherUid", "==", u.uid))),
    ]);
    const map = new Map<string, Booking>();
    [...asClient.docs, ...asPublisher.docs].forEach((d) => map.set(d.id, d.data() as Booking));
    setBookings([...map.values()].sort((a, b) => b.startsAt.localeCompare(a.startsAt)));
  }

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (!u) return router.replace("/login");
        setUser(u);
        load(u).catch((e) => setError(e.message));
      }),
    [router]
  );

  async function cancel(b: Booking) {
    if (!user) return;
    const by = b.publisherUid === user.uid ? "publisher" : "client";
    const hours = (new Date(b.startsAt).getTime() - Date.now()) / 3_600_000;
    const refund = Math.floor(b.amountKobo * refundFraction(hours, by));
    const msg =
      by === "publisher"
        ? `Cancel this session? The client will be refunded ${formatNaira(b.amountKobo)} in full.`
        : refund === b.amountKobo
        ? `Cancel this session? You'll be refunded ${formatNaira(refund)} in full.`
        : refund > 0
        ? `Cancel this session? Under the policy you'll be refunded ${formatNaira(refund)} of ${formatNaira(b.amountKobo)}.`
        : "Cancel this session? It's inside 24 hours, so no refund applies.";
    if (!confirm(msg)) return;
    setBusy(b.reference);
    setError("");
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ reference: b.reference }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't cancel");
      await load(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel");
    } finally {
      setBusy(null);
    }
  }

  if (!user || bookings === null) {
    return <div className="px-6 py-24 text-center text-slate">{error || "Loading…"}</div>;
  }

  const now = Date.now();
  const upcoming = bookings.filter((b) => b.status === "confirmed" && new Date(b.startsAt).getTime() > now);
  const rest = bookings.filter((b) => !upcoming.includes(b));

  function Row({ b, canCancel }: { b: Booking; canCancel: boolean }) {
    const mine = b.publisherUid === user!.uid ? "As publisher" : "As client";
    return (
      <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-ui text-sm font-semibold text-ink">
            {b.date} · {formatSlot(b.slot)} · {b.minutes} min
          </p>
          <p className="text-xs text-slate">
            {mine} · <Link href={`/u/${b.username}`} className="underline">@{b.username}</Link>
            {b.publisherUid === user!.uid && ` · client ${b.clientEmail}`} · {formatNaira(b.amountKobo)}
          </p>
          <p className="mt-1 text-xs text-slate">
            {STATUS_LABEL[b.status] || b.status}
            {b.refundKobo ? ` · refunded ${formatNaira(b.refundKobo)}` : ""}
            {b.status === "confirmed" && new Date(b.startsAt).getTime() <= now ? " · completed" : ""}
          </p>
        </div>
        {canCancel && (
          <button
            onClick={() => cancel(b)}
            disabled={busy === b.reference}
            className="rounded-full border border-rule px-4 py-1.5 text-xs hover:border-crimson hover:text-crimson disabled:opacity-40"
          >
            {busy === b.reference ? "Cancelling…" : "Cancel session"}
          </button>
        )}
      </li>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Your sessions</p>
      <h1 className="mt-3 font-display text-4xl">Bookings</h1>
      <p className="mt-3 text-xs text-slate">{POLICY_TEXT}</p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}

      <h2 className="mt-10 font-display text-xl">Upcoming</h2>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-slate">Nothing scheduled.</p>
      ) : (
        <ul className="mt-2 divide-y divide-rule">{upcoming.map((b) => <Row key={b.reference} b={b} canCancel />)}</ul>
      )}

      <h2 className="mt-10 font-display text-xl">Past &amp; cancelled</h2>
      {rest.length === 0 ? (
        <p className="mt-3 text-sm text-slate">No history yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-rule">{rest.map((b) => <Row key={b.reference} b={b} canCancel={false} />)}</ul>
      )}
    </section>
  );
}
