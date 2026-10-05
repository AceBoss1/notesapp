"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { formatNaira, formatSlot } from "@/lib/booking-time";
import { PAYOUT_HOLD_HOURS, POLICY_TEXT, RESCHEDULE_MAX, canReschedule, refundFraction } from "@/lib/cancellation";
import { sessionEnd } from "@/lib/booking-time";

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
  rescheduleCount?: number;
  reportedProblem?: { reason: string; at: string };
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
  // Inline forms live here (not in Row, which is re-created on every render).
  const [rs, setRs] = useState<{ reference: string; date: string; slots: string[] | null; slot: string | null } | null>(null);
  const [rep, setRep] = useState<{ reference: string; reason: string } | null>(null);

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

  async function pickDate(b: Booking, date: string) {
    setRs({ reference: b.reference, date, slots: null, slot: null });
    if (!date) return;
    try {
      const j = await (await fetch(`/api/booking/slots?username=${encodeURIComponent(b.username)}&date=${date}`)).json();
      setRs((cur) => (cur && cur.reference === b.reference && cur.date === date ? { ...cur, slots: j.slots ?? [] } : cur));
    } catch {
      setRs((cur) => (cur ? { ...cur, slots: [] } : cur));
    }
  }

  async function post(path: string, body: Record<string, unknown>, ref: string, fail: string) {
    if (!user) return;
    setBusy(ref);
    setError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || fail);
      setRs(null);
      setRep(null);
      await load(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : fail);
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
    const isClient = b.clientUid === user!.uid;
    const mine = b.publisherUid === user!.uid ? "As publisher" : "As client";
    const hoursBefore = (new Date(b.startsAt).getTime() - now) / 3_600_000;
    const used = b.rescheduleCount || 0;
    const mayMove = canCancel && isClient && canReschedule(hoursBefore, used);
    const endedAt = sessionEnd(b.date, b.slot, b.minutes).getTime();
    const mayReport = isClient && b.status === "confirmed" && !b.reportedProblem && endedAt <= now && now <= endedAt + PAYOUT_HOLD_HOURS * 3_600_000;
    const tomorrow = new Date(now + 86_400_000).toISOString().slice(0, 10);
    return (
      <li className="flex flex-col gap-3 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            {b.reportedProblem ? " · problem reported — payout paused while we review" : ""}
            {used > 0 ? ` · rescheduled ${used}×` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        {mayMove && (
          <button onClick={() => setRs(rs?.reference === b.reference ? null : { reference: b.reference, date: "", slots: null, slot: null })} className="rounded-full border border-rule px-4 py-1.5 text-xs hover:border-crimson hover:text-crimson">
            Reschedule
          </button>
        )}
        {mayReport && (
          <button onClick={() => setRep(rep?.reference === b.reference ? null : { reference: b.reference, reason: "" })} className="rounded-full border border-rule px-4 py-1.5 text-xs hover:border-crimson hover:text-crimson">
            Report a problem
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => cancel(b)}
            disabled={busy === b.reference}
            className="rounded-full border border-rule px-4 py-1.5 text-xs hover:border-crimson hover:text-crimson disabled:opacity-40"
          >
            {busy === b.reference ? "Working…" : "Cancel session"}
          </button>
        )}
        </div>
        </div>
        {rs?.reference === b.reference && (
          <div className="rounded-xl2 border border-rule bg-paper p-4 text-sm">
            <p className="font-ui font-semibold text-ink">Pick a new time ({RESCHEDULE_MAX - used} reschedule{RESCHEDULE_MAX - used === 1 ? "" : "s"} left, free)</p>
            <input type="date" value={rs.date} min={tomorrow} onChange={(e) => pickDate(b, e.target.value)} className="mt-2 rounded-xl2 border border-rule bg-card px-3 py-2 text-sm" aria-label="New date" />
            {rs.date && rs.slots && rs.slots.length === 0 && <p className="mt-2 text-xs text-slate">No open times that day — try another.</p>}
            {rs.slots && rs.slots.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {rs.slots.map((sl) => (
                  <button key={sl} onClick={() => setRs({ ...rs, slot: sl })} className={`rounded-xl2 border px-3 py-2 text-sm font-semibold ${rs.slot === sl ? "border-crimson bg-crimson text-paper" : "border-rule text-ink hover:border-crimson"}`}>{formatSlot(sl)}</button>
                ))}
              </div>
            )}
            {rs.slot && (
              <button disabled={busy === b.reference} onClick={() => post("/api/bookings/reschedule", { reference: b.reference, date: rs.date, slot: rs.slot }, b.reference, "Couldn't reschedule")} className="btn-primary mt-3 !px-4 !py-2 text-xs">
                {busy === b.reference ? "Moving…" : `Move to ${rs.date} · ${formatSlot(rs.slot)}`}
              </button>
            )}
            <p className="mt-2 text-xs text-slate">Times are in Lagos time (WAT). Cancelling the new time follows the refund policy above.</p>
          </div>
        )}
        {rep?.reference === b.reference && (
          <div className="rounded-xl2 border border-rule bg-paper p-4 text-sm">
            <p className="font-ui font-semibold text-ink">What went wrong?</p>
            <textarea value={rep.reason} onChange={(e) => setRep({ ...rep, reason: e.target.value })} rows={3} className="mt-2 w-full border border-rule bg-card px-3 py-2 text-sm" placeholder="e.g. the publisher didn't show up" />
            <button disabled={busy === b.reference || rep.reason.trim().length < 10} onClick={() => post("/api/bookings/report", { reference: b.reference, reason: rep.reason }, b.reference, "Couldn't send your report")} className="btn-primary mt-2 !px-4 !py-2 text-xs">Send to #NotesApp</button>
            <p className="mt-2 text-xs text-slate">This pauses the publisher&apos;s payout while we look into it. You can report within {PAYOUT_HOLD_HOURS} hours of the session ending.</p>
          </div>
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
