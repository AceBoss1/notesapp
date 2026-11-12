"use client";

import { useState } from "react";
import { FLOWS, MOODS, NOTE_MAX, SLEEP_MAX, SYMPTOMS, WATER_MAX, type Flow, type Mood } from "@/lib/cycle";
import type { CycleData } from "@/lib/cycle-client";
import { fmt, nanaBox, type Call } from "./CycleTabs";

type Advice = { text: string; ai: boolean; notice?: string };

// 5 · The daily check-in: mood, symptoms, energy, pain, water, sleep, flow and a note only she and Nana read. "Save and ask Nana"
// returns one note in three parts (how today fits, what to eat, how to move).
export default function CheckIn({ day, data, call, onClose, onSaved }: { day: string; data: CycleData; call: Call; onClose: () => void; onSaved: () => Promise<void> }) {
  const prev = data.logs.find((l) => l.day === day);
  const [moods, setMoods] = useState<Mood[]>(prev?.moods ?? []);
  const [symptoms, setSymptoms] = useState<string[]>(prev?.symptoms ?? []);
  const [extra, setExtra] = useState("");
  const [adding, setAdding] = useState(false);
  const [energy, setEnergy] = useState<"low" | "ok" | "high" | null>(prev?.energy ?? null);
  const [pain, setPain] = useState<number>(prev?.pain ?? 0);
  const [water, setWater] = useState<number>(prev?.water ?? 0);
  const [sleep, setSleep] = useState<number>(prev?.sleep ?? 7);
  const [flow, setFlow] = useState<Flow | null>(prev?.flow ?? null);
  const [note, setNote] = useState(prev?.note ?? "");
  const [busy, setBusy] = useState<"" | "save" | "ask">("");
  const [error, setError] = useState("");
  const [advice, setAdvice] = useState<Advice | null>(null);
  const inPeriod = data.calendar[day] === "period" || data.today.phase === "menstrual";
  const allSymptoms = Array.from(new Set([...SYMPTOMS.slice(0, 6), ...symptoms]));
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs ${on ? "border-crimson bg-crimson text-white" : "border-rule bg-card text-ink"}`;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const lbl = "mb-1.5 mt-3 block font-ui text-xs font-bold text-ink";

  const save = async (ask: boolean) => {
    setBusy(ask ? "ask" : "save"); setError("");
    try {
      const r = await call<{ advice: Advice | null }>({ action: "log", day, moods, symptoms, energy, pain, water, sleep, flow, note, ask });
      await onSaved();
      if (r.advice) setAdvice(r.advice); else onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); } finally { setBusy(""); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 lg:items-center" role="dialog" aria-modal="true" aria-label="Check-in">
      <div className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-paper lg:max-h-[90vh] lg:rounded-3xl">
        <header className="flex items-center gap-2 bg-gradient-to-r from-crimson-deep to-crimson-bright px-4 py-3 text-white">
          <span className="font-ui text-[15px] font-bold">{day === data.today.today ? "Today's check-in" : `Check-in · ${fmt(day, { weekday: "short", day: "numeric", month: "short" })}`}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15">✕</button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {advice ? (
            <div className="py-4">
              <div className={`${nanaBox} whitespace-pre-line`}><b className="text-crimson">Nana</b><br />{advice.text}{!advice.ai && <span className="mt-1 block text-[11px] text-slate">Nana&apos;s tips for this phase.</span>}</div>
              <button type="button" onClick={onClose} className="mt-4 w-full rounded-full bg-crimson py-3 font-ui text-sm font-bold text-white">Done</button>
            </div>
          ) : (
            <>
              {prev?.advice && <div className={`${nanaBox} mt-4 whitespace-pre-line`}><b className="text-crimson">Nana said</b><br />{prev.advice}</div>}
              <span className={`${lbl} mt-4`}>Mood</span>
              <div className="flex flex-wrap gap-1.5">{MOODS.map((m) => <button key={m.id} type="button" aria-pressed={moods.includes(m.id)} onClick={() => setMoods(toggle(moods, m.id))} className={chip(moods.includes(m.id))}>{m.emoji} {m.label}</button>)}</div>
              <span className={lbl}>Symptoms</span>
              <div className="flex flex-wrap gap-1.5">
                {allSymptoms.map((s) => <button key={s} type="button" aria-pressed={symptoms.includes(s)} onClick={() => setSymptoms(toggle(symptoms, s))} className={chip(symptoms.includes(s))}>{s}</button>)}
                {adding ? (
                  <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); const v = extra.trim().slice(0, 30); if (v) setSymptoms(Array.from(new Set([...symptoms, v]))); setExtra(""); setAdding(false); }}>
                    <input autoFocus value={extra} onChange={(e) => setExtra(e.target.value)} list="cy-symptoms" maxLength={30} placeholder="Another symptom" className="w-36 rounded-full border border-rule bg-card px-3 py-1 text-xs text-ink" />
                    <datalist id="cy-symptoms">{SYMPTOMS.map((s) => <option key={s} value={s} />)}</datalist>
                    <button type="submit" className={chip(false)}>Add</button>
                  </form>
                ) : <button type="button" onClick={() => setAdding(true)} aria-label="Add a symptom" className={chip(false)}>＋</button>}
              </div>
              <span className={lbl}>Energy</span>
              <div className="flex gap-1.5">{(["low", "ok", "high"] as const).map((e) => <button key={e} type="button" aria-pressed={energy === e} onClick={() => setEnergy(energy === e ? null : e)} className={chip(energy === e)}>{e === "ok" ? "OK" : e[0].toUpperCase() + e.slice(1)}</button>)}</div>
              <label className={lbl} htmlFor="cy-pain">Pain (0–5) · {pain}</label>
              <input id="cy-pain" type="range" min={0} max={5} value={pain} onChange={(e) => setPain(Number(e.target.value))} className="w-full accent-[#7A0328]" />
              <span className={lbl}>Water · {water} glass{water === 1 ? "" : "es"}</span>
              <div className="flex gap-1 text-xl">{Array.from({ length: WATER_MAX }, (_, i) => <button key={i} type="button" aria-label={`${i + 1} glasses`} onClick={() => setWater(water === i + 1 ? i : i + 1)} className={i < water ? "" : "opacity-25"}>💧</button>)}</div>
              <label className={lbl} htmlFor="cy-sleep">Sleep · {sleep} h</label>
              <input id="cy-sleep" type="range" min={0} max={SLEEP_MAX} step={0.5} value={sleep} onChange={(e) => setSleep(Number(e.target.value))} className="w-full accent-[#7A0328]" />
              <span className={lbl}>Flow{inPeriod ? "" : " (if you're on your period)"}</span>
              <div className="flex flex-wrap gap-1.5">{FLOWS.map((f) => <button key={f.id} type="button" aria-pressed={flow === f.id} onClick={() => setFlow(flow === f.id ? null : f.id)} className={chip(flow === f.id)}>{f.label}</button>)}</div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} rows={2} placeholder="Anything else? (only you and Nana read this)" className="mt-4 w-full rounded-2xl border border-rule bg-card px-3 py-2 text-sm text-ink" />
              {error && <p className="mt-2 text-sm text-crimson" role="alert">{error}</p>}
              <button type="button" disabled={!!busy} onClick={() => save(true)} className="mt-3 w-full rounded-full bg-crimson py-3 font-ui text-sm font-bold text-white disabled:opacity-60">{busy === "ask" ? "Nana is reading…" : "Save · and ask Nana"}</button>
              <button type="button" disabled={!!busy} onClick={() => save(false)} className="mt-2 w-full py-2 font-ui text-xs font-semibold text-slate">{busy === "save" ? "Saving…" : "Just save"}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
