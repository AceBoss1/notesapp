"use client";

import { useEffect, useState } from "react";
import { nairaOf } from "@/lib/wallet";
import { PPM_ADD_STEP, clock, type Meter, type PpmKind, type PpmRole } from "@/lib/ppm";

// The in-call meter (docs/LIVE_ECONOMY.md 1b, the approved mockup 3-ppm): the time in the call, the bar of held minutes used, what's billed
// so far, and for the viewer "+ Add 15 minutes" (and, when the held minutes run out, the prompt with the seconds left before the call
// ends). The numbers are the server's (lib/ppm-server.ts beatPpm); between two answers the clock only moves on this screen, from the
// server's figure, and the bill shown is the server's.

export type MeterState = { status: string; kind: PpmKind; role: PpmRole; meter: Meter; askTopUp: boolean; perMinuteKobo: number; netKobo?: number };

// The server's elapsed seconds, moving on between its answers (while the call is on).
export function useTicking(m: MeterState | null): number {
  const [base, setBase] = useState<{ sec: number; at: number }>({ sec: 0, at: 0 });
  const [, setNow] = useState(0);
  useEffect(() => { if (m) setBase({ sec: m.meter.elapsedSec, at: Date.now() }); }, [m]);
  const live = m?.status === "live";
  useEffect(() => { if (!live) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [live]);
  if (!m) return 0;
  return live && base.at ? base.sec + Math.floor((Date.now() - base.at) / 1000) : m.meter.elapsedSec;
}

export default function PpmMeter({ state, onAdd, onEnd, busy, error, overlay }: {
  state: MeterState; onAdd?: () => void; onEnd?: () => void; busy?: boolean; error?: string;
  overlay?: boolean; // inside the call screen: no card of its own
}) {
  const sec = useTicking(state);
  const m = state.meter;
  const used = m.holdMinutes ? Math.min(100, (sec / (m.holdMinutes * 60)) * 100) : 0;
  const endsIn = m.endsAt ? Math.max(0, Math.ceil((Date.parse(m.endsAt) - Date.now()) / 1000)) : null;
  const viewer = state.role === "viewer";
  const wrap = overlay
    ? "w-full max-w-md rounded-3xl bg-black/45 p-4 text-left text-white backdrop-blur"
    : "rounded-3xl bg-[#1A1210] p-5 text-white shadow-xl lg:p-6";
  return (
    <div className={wrap} aria-label="Session meter">
      <p className="font-ui text-[12px] font-bold uppercase tracking-[0.16em] text-[#E8B23A]">{state.status === "live" ? "In the call" : state.status === "ended" ? "The call ended" : "Waiting for the call"} · {state.kind}</p>
      <p className={`font-ui font-extrabold leading-none tabular-nums ${overlay ? "mt-2 text-4xl" : "my-3 text-[54px]"}`} aria-live="off">{clock(sec)}</p>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#3a2a22]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used)} aria-label="Held minutes used">
        <i className={`block h-full ${state.askTopUp ? "bg-[#E5383B]" : "bg-[#E8B23A]"}`} style={{ width: `${used}%` }} />
      </div>
      <p className="mt-3 text-[15px]" aria-live="polite">{m.billedMinutes} min billed · <b>{nairaOf(m.chargeKobo)}</b> of {nairaOf(m.holdKobo)} held · {Math.max(0, Math.floor((m.holdMinutes * 60 - sec) / 60))} min left</p>
      {m.graceLeftSec > 0 && state.status === "live" && <p className="mt-1 text-xs text-white/60">The first {Math.max(0, m.graceLeftSec - (sec - m.elapsedSec))} seconds are free if the call ends now.</p>}
      {!viewer && typeof state.netKobo === "number" && <p className="mt-1 text-xs text-white/60">You keep ₦{(state.netKobo / 100).toLocaleString("en-NG")} of it so far.</p>}
      {state.askTopUp && (
        <div className="mt-3 rounded-2xl bg-[#E5383B]/20 px-4 py-3 text-sm" role="alert">
          {viewer ? <><b>Your held minutes are used up.</b> Add minutes to keep talking{endsIn !== null ? <>, or the call ends in <b className="tabular-nums">{clock(endsIn)}</b></> : null}.</>
            : <><b>Their held minutes are used up.</b> They&apos;ve been asked to add minutes{endsIn !== null ? <>; otherwise the call ends in <b className="tabular-nums">{clock(endsIn)}</b></> : null}.</>}
        </div>
      )}
      {(onAdd || onEnd) && state.status !== "ended" && (
        <div className="mt-4 flex flex-wrap gap-2.5">
          {viewer && onAdd && <button type="button" onClick={onAdd} disabled={busy} className="rounded-full bg-[#E8B23A] px-5 py-2.5 font-ui text-[15px] font-bold text-[#1A1210] disabled:opacity-50">+ Add {PPM_ADD_STEP} minutes</button>}
          {onEnd && <button type="button" onClick={onEnd} className="rounded-full bg-white px-5 py-2.5 font-ui text-[15px] font-bold text-ink">End call</button>}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-[#ffb4b4]" role="alert">{error}</p>}
    </div>
  );
}
