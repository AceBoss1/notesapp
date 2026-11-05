"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { capi } from "@/components/community/api";
import { placeCall } from "@/components/calls/CallManager";
import PpmMeter, { type MeterState } from "@/components/ppm/PpmMeter";
import { formatNaira, formatSlot } from "@/lib/booking-time";
import { PAYOUT_HOLD_HOURS } from "@/lib/cancellation";
import { PPM_ADD_STEP, PPM_EARLY_MS, PPM_KIND_LABEL, callKindOf, type Meter, type PpmEndWhy, type PpmKind, type PpmRole, type PpmStatus } from "@/lib/ppm";

// A pay-per-minute session's page (/ppm/[id]) and the list of yours (/ppm): the booking, Start the call, the server's meter while the
// call is on (also shown over the call screen), what it came to, and cancelling or reporting a problem. lib/ppm-server.ts holds the rules.

type View = {
  id: string; role: PpmRole; status: PpmStatus; kind: PpmKind; perMinuteKobo: number; holdMinutes: number; holdKobo: number;
  date: string; slot: string; startsAt: string; graceSec: number; topUpWaitSec: number;
  host: { uid: string; name: string; username: string }; viewer: { uid: string; name: string; username: string };
  startedAt: string | null; endedAt: string | null; endWhy: PpmEndWhy | null; callId: string | null;
  askTopUp: boolean; meter: Meter; now: string; billedMinutes: number | null; chargeKobo: number | null; releasedKobo: number | null;
  commissionRate?: number; netKobo?: number; heard: { viewer: boolean; host: boolean };
};
function useUser(): User | null | undefined {
  const [u, setU] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setU), []);
  return u;
}
const day = (date: string) => new Date(`${date}T12:00:00+01:00`).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" });
const STATUS: Record<PpmStatus, string> = { booked: "Booked", live: "In the call", ended: "Ended", cancelled: "Cancelled", expired: "Didn't happen" };
const WHY: Record<PpmEndWhy, string> = {
  ended: "The call was ended.", hold_ran_out: "The held minutes ran out and none were added.", dropped: "A phone left the call.",
  host_cancelled: "The publisher cancelled.", viewer_cancelled: "Cancelled before the call.", no_show: "The call didn't start in time.", admin: "Ended by #NotesApp.",
};

export function PpmSessionPage({ id }: { id: string }) {
  const user = useUser();
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState("");
  const [note, setNote] = useState("");
  const load = useCallback(async () => {
    try { setV(await capi<View>(`/api/ppm?id=${encodeURIComponent(id)}`)); setErr(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't load the session."); }
  }, [id]);
  useEffect(() => { if (user) void load(); }, [user, load]);
  // While the session is booked or on, the page follows the server's meter.
  useEffect(() => {
    if (!v || (v.status !== "booked" && v.status !== "live")) return;
    const t = setInterval(load, v.status === "live" ? 10_000 : 30_000);
    return () => clearInterval(t);
  }, [v, load]);

  if (user === null) return <p className="py-16 text-center text-slate"><Link href={`/login?next=/ppm/${id}`} className="text-crimson underline">Sign in</Link> to see this session.</p>;
  if (err && !v) return <p className="py-16 text-center text-slate">{err}</p>;
  if (!v) return <p className="py-16 text-center text-slate">Loading…</p>;
  const other = v.role === "viewer" ? v.host : v.viewer;
  const opensAt = Date.parse(v.startsAt) - PPM_EARLY_MS;
  const canCall = (v.status === "booked" || v.status === "live") && Date.now() >= opensAt;
  const act = async (body: Record<string, unknown>, done?: string) => {
    setBusy(true); setErr(""); setNote("");
    try { await capi("/api/ppm", { ...body, id }); if (done) setNote(done); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't do that."); }
    finally { setBusy(false); }
  };
  const meterState: MeterState = { status: v.status, kind: v.kind, role: v.role, meter: v.meter, askTopUp: v.askTopUp, perMinuteKobo: v.perMinuteKobo, ...(typeof v.netKobo === "number" ? { netKobo: v.netKobo } : {}) };

  return (
    <div>
      <p className="eyebrow">Pay-per-minute · {PPM_KIND_LABEL[v.kind]}</p>
      <h1 className="mt-2 font-display text-4xl text-ink">{v.role === "viewer" ? `Talk to ${v.host.name}` : `Session with ${v.viewer.name}`}</h1>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5 lg:p-6">
          <p className="font-ui text-sm font-semibold text-slate">{STATUS[v.status]}</p>
          <p className="mt-1 text-lg text-ink">{day(v.date)} · {formatSlot(v.slot)} <span className="text-sm text-slate">(Lagos time)</span></p>
          <p className="mt-2 text-base text-ink">{PPM_KIND_LABEL[v.kind]} at <b>{formatNaira(v.perMinuteKobo)}</b> a minute · {v.holdMinutes} minutes held ({formatNaira(v.holdKobo)})</p>
          <p className="mt-1 text-sm text-slate">{v.role === "viewer"
            ? `Held from your NotesApp Credit, not charged. You pay per started minute once the call passes ${v.graceSec} seconds; unused minutes come back when it ends.`
            : `Paid to you after the call ends and a ${PAYOUT_HOLD_HOURS}-hour window for problems, less your rate plus the pay-per-minute share.`}</p>
          {v.role === "viewer" ? <p className="mt-1 text-sm text-slate">With <Link href={`/u/${v.host.username}`} className="text-crimson underline">@{v.host.username}</Link></p> : <p className="mt-1 text-sm text-slate">Booked by @{v.viewer.username}</p>}
          {(v.status === "booked" || v.status === "live") && (
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button type="button" className="btn-primary disabled:opacity-50" disabled={!canCall || busy}
                onClick={() => placeCall({ toUid: other.uid, kind: callKindOf(v.kind), name: other.name, avatar: "", ppm: v.id })}>
                {v.status === "live" ? "Back to the call" : `Start the ${v.kind} call`}
              </button>
              {v.role === "viewer" && v.status === "booked" && <button type="button" disabled={busy} onClick={() => act({ action: "add", minutes: PPM_ADD_STEP }, `${PPM_ADD_STEP} more minutes held.`)} className="rounded-full border border-rule px-5 py-2 font-ui text-sm font-semibold text-ink hover:border-crimson disabled:opacity-50">+ Hold {PPM_ADD_STEP} more minutes</button>}
              {v.status === "booked" && <button type="button" disabled={busy} onClick={() => { if (confirm(v.role === "viewer" ? "Cancel this session? Everything held comes back to your NotesApp Credit." : "Cancel this session? Everything they held goes back to them.")) void act({ action: "cancel" }, "Cancelled."); }} className="rounded-full border border-rule px-5 py-2 font-ui text-sm font-semibold text-ink hover:border-crimson disabled:opacity-50">Cancel</button>}
            </div>
          )}
          {v.status === "booked" && !canCall && <p className="mt-2 text-xs text-slate">The call opens {PPM_EARLY_MS / 60_000} minutes before the time. Either of you can start it.</p>}
          {(v.status === "ended" || v.status === "cancelled" || v.status === "expired") && (
            <div className="mt-4 rounded-2xl bg-paper px-4 py-3 text-sm text-ink">
              {v.status === "ended"
                ? <>{v.billedMinutes} min billed · <b>{formatNaira(v.chargeKobo ?? 0)}</b>{v.role === "viewer" ? <> · {formatNaira(v.releasedKobo ?? 0)} back to your NotesApp Credit</> : typeof v.netKobo === "number" ? <> · you earn <b>{formatNaira(v.netKobo)}</b></> : null}</>
                : v.role === "viewer" ? <>Nothing was charged: {formatNaira(v.releasedKobo ?? v.holdKobo)} came back to your NotesApp Credit.</> : <>Nothing was charged.</>}
              {v.endWhy && <span className="block text-xs text-slate">{WHY[v.endWhy]}</span>}
            </div>
          )}
          {v.status === "ended" && v.role === "viewer" && !!v.chargeKobo && v.endedAt && Date.now() < Date.parse(v.endedAt) + PAYOUT_HOLD_HOURS * 3_600_000 && (
            <details className="mt-3 text-sm"><summary className="cursor-pointer text-slate">Report a problem (within {PAYOUT_HOLD_HOURS} hours)</summary>
              <textarea value={report} onChange={(e) => setReport(e.target.value)} maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm" placeholder="What went wrong?" />
              <button type="button" disabled={busy || report.trim().length < 5} onClick={() => act({ action: "report", reason: report }, "Thanks. The publisher's payout is paused while we review it.")} className="mt-2 rounded-full border border-rule px-4 py-1.5 text-xs font-semibold disabled:opacity-50">Send</button>
            </details>
          )}
          {note && <p className="mt-3 text-sm text-ink">{note}</p>}
          {err && <p className="mt-3 text-sm text-crimson" role="alert">{err}</p>}
        </div>
        {(v.status === "live" || v.status === "ended") && (
          <PpmMeter state={meterState} busy={busy} onAdd={v.role === "viewer" ? () => act({ action: "add", minutes: PPM_ADD_STEP }) : undefined}
            onEnd={v.callId ? () => { if (confirm("End the call? You pay only for the minutes used.")) void capi("/api/calls", { action: "end", id: v.callId, reason: "ended" }).then(load, (e) => setErr(e instanceof Error ? e.message : "Couldn't end the call.")); } : undefined} />
        )}
      </div>
    </div>
  );
}

export function PpmHome() {
  const user = useUser();
  const [d, setD] = useState<{ booked: View[]; hosting: View[] } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (user) capi<{ booked: View[]; hosting: View[] }>("/api/ppm").then(setD).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load.")); }, [user]);
  if (user === null) return <p className="py-16 text-center text-slate"><Link href="/login?next=/ppm" className="text-crimson underline">Sign in</Link> to see your sessions.</p>;
  const row = (x: View) => (
    <li key={x.id}><Link href={`/ppm/${x.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-crimson">
      <span className="min-w-0"><b className="block truncate text-ink">{x.role === "viewer" ? x.host.name : x.viewer.name}</b>
        <span className="text-xs text-slate">{day(x.date)} · {formatSlot(x.slot)} · {PPM_KIND_LABEL[x.kind]} {formatNaira(x.perMinuteKobo)}/min</span></span>
      <span className="shrink-0 text-right text-xs text-slate">{STATUS[x.status]}{x.status === "ended" && x.chargeKobo !== null ? <b className="block text-sm text-ink">{formatNaira(x.chargeKobo)}</b> : null}</span>
    </Link></li>
  );
  return (
    <div>
      <p className="eyebrow">Sessions · per minute</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Pay-per-minute sessions</h1>
      <p className="mt-2 text-sm text-slate">Voice and video calls with a publisher, paid by the minute from NotesApp Credit. Book from their profile; publishers set their prices under <Link href="/profile/publishing" className="text-crimson underline">Rates &amp; payouts</Link>. <Link href="/help/pay-per-minute" className="text-crimson underline">How it works</Link></p>
      {err && <p className="mt-4 text-sm text-crimson">{err}</p>}
      {!d ? <p className="mt-6 text-sm text-slate">Loading…</p> : (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="card p-5"><h2 className="font-ui text-sm font-bold text-ink">You booked</h2>
            {d.booked.length ? <ul className="mt-1 divide-y divide-rule">{d.booked.map(row)}</ul> : <p className="mt-2 text-sm text-slate">Nothing yet.</p>}</div>
          <div className="card p-5"><h2 className="font-ui text-sm font-bold text-ink">Booked with you</h2>
            {d.hosting.length ? <ul className="mt-1 divide-y divide-rule">{d.hosting.map(row)}</ul> : <p className="mt-2 text-sm text-slate">Nothing yet.</p>}</div>
        </div>
      )}
    </div>
  );
}
