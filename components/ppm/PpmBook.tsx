"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { capi } from "@/components/community/api";
import { formatNaira, formatSlot } from "@/lib/booking-time";
import MonthCalendar from "@/components/MonthCalendar";
import { holdFor, type PpmAudience, type PpmKind } from "@/lib/ppm";
import type { PpmFigures } from "@/lib/rooms";

// "Book · per minute" on a publisher's profile (docs/LIVE_ECONOMY.md 1b, the approved mockup 3-ppm): voice or video at their price per
// minute, one of their open times, and the minutes to hold. The minutes' price is held from NotesApp Credit (not charged); the call is
// metered by the server and only what's used is paid. Renders nothing while the publisher doesn't offer it.

type Offer = {
  offered: true; figures: PpmFigures & { upliftPct: number };
  host: { uid: string; username: string; name: string };
  voiceKobo: number; videoKobo: number; audience: PpmAudience; audienceLine: string;
  tier: string | null; canBook: boolean; why: string; creditKobo: number | null;
} | { offered: false; figures: PpmFigures & { upliftPct: number } };
type Slots = { bookable: boolean; slots: string[] };
const seg = (on: boolean) => `rounded-full px-4 py-2 font-ui text-[15px] ${on ? "bg-crimson text-paper" : "border border-rule bg-card text-ink hover:border-crimson"}`;
const lagosDay = (date: string) => new Date(`${date}T12:00:00+01:00`).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" });

export default function PpmBook({ username, viewer }: { username: string; viewer: User | null | undefined }) {
  const router = useRouter();
  const [o, setO] = useState<Offer | null>(null);
  const [kind, setKind] = useState<PpmKind>("voice");
  const [minutes, setMinutes] = useState("30");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slots | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (viewer === undefined) return;
    capi<Offer>(`/api/ppm?username=${encodeURIComponent(username)}`).then((x) => {
      setO(x);
      if (x.offered) {
        if (!x.voiceKobo && x.videoKobo) setKind("video");
        setMinutes((m) => String(Math.max(Number(m) || 0, x.figures.minMinutes)));
      }
    }).catch(() => setO(null));
  }, [username, viewer]);
  useEffect(() => {
    setSlot(null); setSlots(null);
    if (!date) return;
    fetch(`/api/booking/slots?ppm=1&username=${encodeURIComponent(username)}&date=${date}`).then((r) => r.json()).then(setSlots).catch(() => setSlots({ bookable: false, slots: [] }));
  }, [date, username]);
  useEffect(() => {
    // Open on the first day from tomorrow (Lagos).
    if (!date) setDate(new Date(Date.now() + 3_600_000 + 86_400_000).toISOString().slice(0, 10));
  }, [date]);

  if (!o || !o.offered || viewer?.uid === o.host.uid) return null;
  const per = kind === "video" ? o.videoKobo : o.voiceKobo;
  const mins = Math.max(0, Math.floor(Number(minutes) || 0));
  const hold = holdFor(mins, per);
  const short = o.creditKobo !== null && hold > o.creditKobo;
  const tooFew = mins < o.figures.minMinutes;
  const tooMany = mins > o.figures.maxMinutes;
  const tomorrow = new Date(Date.now() + 3_600_000 + 86_400_000).toISOString().slice(0, 10);

  async function book() {
    setErr("");
    if (!viewer) return void router.push(`/login?next=${encodeURIComponent(`/u/${username}#ppm`)}`);
    if (!slot) return setErr("Pick a time.");
    setBusy(true);
    try {
      const r = await capi<{ session: { id: string } }>("/api/ppm", { action: "book", username, kind, minutes: mins, date, slot });
      router.push(`/ppm/${r.session.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't book."); setBusy(false); }
  }

  return (
    <div id="ppm" className="card mt-8 p-5 lg:p-6">
      <p className="eyebrow">Book · per minute</p>
      <h2 className="mt-1 font-display text-[26px] leading-tight text-ink">Talk to {o.host.name}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {o.voiceKobo > 0 && <button type="button" aria-pressed={kind === "voice"} onClick={() => setKind("voice")} className={seg(kind === "voice")}>🎙 Voice {formatNaira(o.voiceKobo)}/min</button>}
        {o.videoKobo > 0 && <button type="button" aria-pressed={kind === "video"} onClick={() => setKind("video")} className={seg(kind === "video")}>🎥 Video {formatNaira(o.videoKobo)}/min</button>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,20rem),1fr] sm:items-start">
        <div><span className="mb-1.5 block font-ui text-sm font-semibold text-slate">Day</span>
          <MonthCalendar value={date} min={tomorrow} onChange={setDate} label="Session date" />
        </div>
        <div className="min-w-0">
          {date && slots && slots.slots.length === 0 && <p className="text-sm text-slate">No times on that day. Try another.</p>}
          {slots && slots.slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {slots.slots.map((s) => <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)} className={`rounded-full border px-3.5 py-2 font-ui text-sm font-semibold ${slot === s ? "border-crimson bg-crimson text-paper" : "border-rule text-ink hover:border-crimson"}`}>{formatSlot(s)}</button>)}
            </div>
          )}
        </div>
      </div>
      <label className="mt-4 block"><span className="mb-1.5 block font-ui text-sm font-semibold text-slate">Minutes to hold (you pay only what you use)</span>
        <input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, "").slice(0, 4))} aria-label="Minutes to hold" className="w-full rounded-2xl border border-rule bg-card px-4 py-3 text-base text-ink outline-none focus:border-crimson" />
      </label>
      <p className="mt-3 text-base text-ink">Held now: <b>{formatNaira(hold)}</b> from NotesApp Credit · unused minutes go back</p>
      {tooFew && <p className="mt-1 text-sm text-crimson">Hold at least {o.figures.minMinutes} minutes.</p>}
      {tooMany && <p className="mt-1 text-sm text-crimson">Hold at most {o.figures.maxMinutes} minutes now; you can add more during the call.</p>}
      {short && <p className="mt-1 text-sm text-crimson">You have {formatNaira(o.creditKobo!)} of NotesApp Credit. <Link href="/profile/wallet#top-up" className="underline">Top up</Link> to hold this much.</p>}
      <p className="mt-2 text-sm text-slate">{o.audienceLine}{slot ? ` ${lagosDay(date)} · ${formatSlot(slot)}.` : " Times in Lagos time (WAT)."} Charged per started minute after the first {o.figures.graceSec} seconds.</p>
      {o.why ? <p className="mt-3 text-sm text-crimson">{o.why}</p> : (
        <button type="button" onClick={book} disabled={busy || tooFew || tooMany || short || (!!viewer && !slot) || !per} className="btn-primary mt-4 disabled:opacity-50">
          {busy ? "Booking…" : viewer ? `Book and hold ${formatNaira(hold)}` : "Sign in to book"}
        </button>
      )}
      {err && <p className="mt-3 text-sm text-crimson" role="alert">{err}</p>}
    </div>
  );
}

