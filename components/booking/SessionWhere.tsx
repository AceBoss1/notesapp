"use client";

import { NIGERIAN_STATES } from "@/lib/merch";
import type { Where } from "@/lib/event-kit";

// Where sessions happen (docs/EVENTS_DISCOVER.md), on Rates & payouts: in person (the address, shown to a client once booked), online
// (a #NotesApp call at the booked time, or your own link) or both, the client choosing when they book.
export type WhereDraft = { format: string; place: string; city: string; state: string; online: string; link: string };
export const draftOf = (w?: Where | null): WhereDraft => ({ format: w?.format ?? "", place: w?.place ?? "", city: w?.city ?? "", state: w?.state ?? "", online: w?.online || "notesapp", link: w?.link ?? "" });
const input = "mt-1 w-full rounded-lg border border-rule bg-card px-3 py-2 text-sm";

export default function SessionWhere({ value, onChange }: { value: WhereDraft; onChange: (v: WhereDraft) => void }) {
  const set = (k: keyof WhereDraft) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const inPerson = value.format === "in_person" || value.format === "hybrid", online = value.format === "online" || value.format === "hybrid";
  return (
    <fieldset className="mt-4 rounded-xl border border-rule p-3">
      <legend className="px-1 text-xs font-bold text-ink">Where sessions happen</legend>
      <div className="flex flex-wrap gap-2 text-xs">
        {[["", "Not said"], ["online", "Online"], ["in_person", "In person"], ["hybrid", "Either: the client chooses"]].map(([id, label]) => (
          <label key={id} className={`flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 ${value.format === id ? "border-crimson bg-crimson/5 font-bold" : "border-rule"}`}>
            <input type="radio" className="sr-only" checked={value.format === id} onChange={() => onChange({ ...value, format: id })} />{label}
          </label>
        ))}
      </div>
      {inPerson && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-xs text-slate sm:col-span-3">Address (shown to a client once they&apos;ve booked)<input value={value.place} onChange={set("place")} maxLength={200} className={input} /></label>
          <label className="text-xs text-slate">City<input value={value.city} onChange={set("city")} maxLength={60} className={input} /></label>
          <label className="text-xs text-slate">State<select value={value.state} onChange={set("state")} className={input}><option value="">—</option>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
        </div>
      )}
      {online && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate">Online on<select value={value.online} onChange={set("online")} className={input}><option value="notesapp">A #NotesApp call at the booked time</option><option value="link">My own link (Zoom, Meet, Teams…)</option></select></label>
          {value.online === "link" && <label className="text-xs text-slate">The link (shown once booked)<input value={value.link} onChange={set("link")} inputMode="url" placeholder="https://…" className={input} /></label>}
        </div>
      )}
      {online && value.online === "notesapp" && <p className="mt-2 text-xs text-slate">You and your client can call each other on #NotesApp from 15 minutes before the session until 15 minutes after it, even if you don&apos;t follow each other.</p>}
    </fieldset>
  );
}
