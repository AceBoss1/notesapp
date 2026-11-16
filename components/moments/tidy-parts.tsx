"use client";

import { useMemo } from "react";
import type { Span } from "@/lib/moments-tidy";
import type { Sound } from "@/lib/moments-tidy-client";

// Small parts shared by the Moments screens (the owner's "Moments Redesign", Moda, 16 Nov 2026).
export const cardCls = "rounded-3xl border border-rule bg-card";
export const pillPrimary = "inline-flex h-12 items-center justify-center rounded-full bg-crimson px-7 font-ui text-[15px] font-bold text-white disabled:opacity-50";
export const pillGhost = "inline-flex h-12 items-center justify-center rounded-full border border-crimson/60 bg-card px-7 font-ui text-[15px] font-bold text-crimson disabled:opacity-50";
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={`relative h-8 w-[3.25rem] shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-crimson" : "bg-[#D5C9C2]"}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

// "Step 2 of 3" and its bars.
export function Steps({ step, of }: { step: number; of: number }) {
  if (of < 2) return null;
  return (
    <div className="flex items-center gap-3 lg:w-64">
      <span className="shrink-0 font-ui text-[13px] text-slate lg:order-first">Step {step} of {of}</span>
      <span className="hidden flex-1 gap-1.5 lg:flex" aria-hidden>{Array.from({ length: of }, (_, i) => <i key={i} className={`h-1 flex-1 rounded-full ${i < step ? "bg-crimson" : "bg-rule"}`} />)}</span>
    </div>
  );
}
export function StepBars({ step, of }: { step: number; of: number }) {
  if (of < 2) return null;
  return <div className="mt-4 flex gap-1.5 lg:hidden" aria-hidden>{Array.from({ length: of }, (_, i) => <i key={i} className={`h-1 flex-1 rounded-full ${i < step ? "bg-crimson" : "bg-rule"}`} />)}</div>;
}

// The sound wave: bars where she speaks, dots where a pause is taken out.
export function Wave({ sound, pauses, kept }: { sound: Sound; pauses: Span[]; kept: Set<number> }) {
  const bars = useMemo(() => {
    const n = 44, per = Math.max(1, Math.floor(sound.levels.length / n)), max = Math.max(0.0001, ...sound.levels);
    return Array.from({ length: n }, (_, i) => {
      const slice = sound.levels.slice(i * per, (i + 1) * per), t = ((i + 0.5) * per * sound.duration) / Math.max(1, sound.levels.length);
      return { h: Math.max(14, Math.round((Math.max(0, ...slice) / max) * 100)), cut: pauses.some(([a, b], j) => !kept.has(j) && t >= a && t <= b) };
    });
  }, [sound, pauses, kept]);
  return (
    <div className={`${cardCls} flex h-16 items-center gap-[3px] px-4`} aria-hidden>
      {bars.map((b, i) => b.cut ? <i key={i} className="mx-auto h-1 w-1 shrink-0 rounded-full bg-[#CFC3BC]" /> : <i key={i} className="flex-1 rounded-full bg-crimson" style={{ height: `${b.h}%`, maxWidth: 4 }} />)}
    </div>
  );
}
export const Legend = ({ out }: { out: number }) => (
  <p className="flex flex-wrap gap-x-6 gap-y-1 font-ui text-[13px] text-slate"><span><i className="mr-2 inline-block h-3 w-3 rounded-[3px] bg-crimson align-[-1px]" />You speaking</span><span><i className="mr-2 inline-block h-3 w-3 rounded-[3px] bg-[#D5C9C2] align-[-1px]" />Pauses taken out ({out})</span></p>
);
export const Notice = ({ children }: { children: React.ReactNode }) => <p className="rounded-2xl border border-[#EFD98F] bg-[#FFF5D1] px-4 py-3 font-ui text-[13.5px] leading-snug text-[#5A4300]">{children}</p>;
