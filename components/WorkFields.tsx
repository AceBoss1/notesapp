"use client";

import { INDUSTRIES, JOB_TITLE_MAX, WORKPLACE_MAX, type Work } from "@/lib/profile-work";

// The three optional lines: what you do, your role, where you work. Shared by sign-up and Edit profile.
// Organisations only get the first (they have no personal job title).
export default function WorkFields({ value, onChange, inputClass, orgOnly = false }: { value: Work; onChange: (v: Work) => void; inputClass: string; orgOnly?: boolean }) {
  return (
    <fieldset className="space-y-4">
      <legend className="eyebrow">{orgOnly ? "About your organisation" : "About you"} <span className="normal-case tracking-normal text-slate">(optional, shown on your profile)</span></legend>
      <label className="block">
        <span className="text-sm text-ink">{orgOnly ? "What does your organisation do?" : "What do you do?"}</span>
        <select value={value.industry ?? ""} onChange={(e) => onChange({ ...value, industry: e.target.value })} className={inputClass}>
          <option value="">Prefer not to say</option>
          {INDUSTRIES.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
        </select>
      </label>
      {!orgOnly && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-ink">Your role</span>
            <input value={value.jobTitle ?? ""} maxLength={JOB_TITLE_MAX} onChange={(e) => onChange({ ...value, jobTitle: e.target.value })} placeholder="e.g. CEO" autoComplete="organization-title" className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm text-ink">Where you work</span>
            <input value={value.workplace ?? ""} maxLength={WORKPLACE_MAX} onChange={(e) => onChange({ ...value, workplace: e.target.value })} placeholder="e.g. Adams Ltd" autoComplete="organization" className={inputClass} />
          </label>
        </div>
      )}
    </fieldset>
  );
}
