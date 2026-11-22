"use client";

import { EXPERIENCE_MAX, JOB_TITLE_MAX, WORKPLACE_MAX, type Experience } from "@/lib/profile-work";

// Other roles, now and past (lib/profile-work.ts): a second job, a board seat, a lectureship, the jobs before this one. Edit profile only;
// the main role (WorkFields) stays the line under your name. Saved tidied by cleanExperience.
const blank = (): Experience => ({ title: "", org: "", from: "", to: "", current: false });

export default function RolesFields({ value, onChange, inputClass }: { value: Experience[]; onChange: (v: Experience[]) => void; inputClass: string }) {
  const set = (i: number, patch: Partial<Experience>) => onChange(value.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="eyebrow">More roles, now and past <span className="normal-case tracking-normal text-slate">(optional, shown in Work on your profile)</span></legend>
      <p className="text-sm text-slate">Another job, a board seat, teaching, or the jobs you had before. Helpful for founders, job seekers, professionals and academics.</p>
      {value.map((e, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-rule bg-card p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-sm text-ink">Role</span>
              <input value={e.title} maxLength={JOB_TITLE_MAX} onChange={(ev) => set(i, { title: ev.target.value })} placeholder="e.g. Lecturer" className={inputClass} /></label>
            <label className="block"><span className="text-sm text-ink">Where</span>
              <input value={e.org} maxLength={WORKPLACE_MAX} onChange={(ev) => set(i, { org: ev.target.value })} placeholder="e.g. University of Lagos" className={inputClass} /></label>
            <label className="block"><span className="text-sm text-ink">From</span>
              <input type="month" value={e.from} min="1950-01" onChange={(ev) => set(i, { from: ev.target.value })} className={inputClass} /></label>
            <label className="block"><span className="text-sm text-ink">To</span>
              <input type="month" value={e.current ? "" : e.to} min={e.from || "1950-01"} disabled={e.current} onChange={(ev) => set(i, { to: ev.target.value })} className={`${inputClass} disabled:opacity-50`} /></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={e.current} onChange={(ev) => set(i, { current: ev.target.checked, ...(ev.target.checked ? { to: "" } : {}) })} className="h-4 w-4 accent-crimson" />
              I still do this
            </label>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-full px-3 py-1 font-ui text-sm font-semibold text-crimson hover:bg-crimson/5">Remove</button>
          </div>
        </div>
      ))}
      {value.length < EXPERIENCE_MAX ? (
        <button type="button" onClick={() => onChange([...value, blank()])} className="inline-flex rounded-full border border-dashed border-crimson/50 px-4 py-2 font-ui text-sm font-semibold text-crimson hover:bg-crimson/5">
          + {value.length ? "Add another role" : "Add a role"}
        </button>
      ) : <p className="text-xs text-slate">That&apos;s the most: {EXPERIENCE_MAX} roles.</p>}
    </fieldset>
  );
}
