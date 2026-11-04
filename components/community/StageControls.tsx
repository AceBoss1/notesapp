"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { MOD_PERMS, MOD_PRESETS, ROOM_MODS_MAX, STAGE_MODES, type ModPerm, type StageMode } from "@/lib/rooms";

// The stage's controls in an audio room (lib/rooms.ts "Stage seats"): the stage mode, the empty seats with +, and the sheet where the
// host names the live's moderators and ticks what each may do. Plain props, so they can be shown on their own (screenshots, tests).

export type StaffRow = { uid: string; username: string; name: string; avatar: string; role: string };
// One moderator being named: who (a uid, or @username for someone typed in), the name to show, and the permissions ticked.
export type ModPick = { who: string; name: string; avatar?: string; perms: ModPerm[] };

// Solo / Approve / Open, as a segmented switch on the dark room screen (the host, or a moderator allowed to change it).
export function ModeSwitch({ value, onChange, busy }: { value: StageMode; onChange: (m: StageMode) => void; busy?: boolean }) {
  return (
    <div className="mb-4">
      <div role="radiogroup" aria-label="Stage mode" className="inline-flex rounded-full bg-white/10 p-1">
        {STAGE_MODES.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={value === m.id} disabled={busy} onClick={() => value !== m.id && onChange(m.id)}
            className={`rounded-full px-4 py-1.5 font-ui text-xs font-bold transition ${value === m.id ? "bg-white text-ink" : "text-white/70 hover:text-white"}`}>{m.label}</button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-white/55">{STAGE_MODES.find((m) => m.id === value)?.hint}</p>
    </div>
  );
}

// The same choice in the Start a room form (light card).
export function StageModeChoice({ value, onChange }: { value: StageMode; onChange: (m: StageMode) => void }) {
  return (
    <fieldset className="w-full">
      <legend className="text-xs text-slate">Stage (you can change it during the live):</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {STAGE_MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={value === m.id} onClick={() => onChange(m.id)}
            className={`rounded-full px-3 py-1 font-ui text-xs font-semibold ${value === m.id ? "bg-crimson text-paper" : "border border-rule text-ink"}`}>{m.label}</button>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate">{STAGE_MODES.find((m) => m.id === value)?.hint}</p>
    </fieldset>
  );
}

// An empty chair on stage: a + in the centre when tapping it does something for this person (a request, or the seat itself).
export function Seat({ plus, asked, onTap, busy }: { plus: boolean; asked?: boolean; onTap: () => void; busy?: boolean }) {
  const label = asked ? "Seat requested" : plus ? "Empty seat: tap to come up" : "Empty seat";
  return (
    <li className="flex flex-col items-center text-center">
      <button type="button" disabled={!plus || busy || asked} onClick={onTap} aria-label={label}
        className={`flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed sm:h-20 sm:w-20 ${plus && !asked ? "border-white/40 bg-white/[0.06] text-white/80 hover:border-white hover:bg-white/10 hover:text-white" : "border-white/15 text-white/20"}`}>
        {asked ? <span className="text-xl" aria-hidden>✋</span> : plus ? <span className="text-3xl font-light leading-none" aria-hidden>+</span> : <ChairIcon />}
      </button>
      <span className="mt-1.5 font-ui text-sm text-white/45">{asked ? "Asked" : plus ? "Take a seat" : "Empty"}</span>
    </li>
  );
}
function ChairIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M7 4h10v8H7zM5 12h14v3H5zM7 15v5M17 15v5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// The host's "Moderators" sheet: pick from the community's moderators and admins or type an @username, then tick each one's
// permissions (Basic and Full set them in one tap). The host keeps everything; ending the live is off unless ticked.
export function ModSheet({ staff, value, onSave, onClose, busy, light, saveLabel = "Save moderators" }: { staff: StaffRow[]; value: ModPick[]; onSave: (list: ModPick[]) => void; onClose: () => void; busy?: boolean; light?: boolean; saveLabel?: string }) {
  const [list, setList] = useState<ModPick[]>(value);
  const [handle, setHandle] = useState("");
  const [open, setOpen] = useState<string | null>(value[0]?.who ?? null);
  const has = (who: string) => list.some((m) => m.who === who);
  const add = (m: ModPick) => { if (!has(m.who) && list.length < ROOM_MODS_MAX) { setList([...list, m]); setOpen(m.who); } };
  const set = (who: string, perms: ModPerm[]) => setList(list.map((m) => (m.who === who ? { ...m, perms } : m)));
  const preset = (perms: ModPerm[]) => MOD_PRESETS.find((p) => p.perms.length === perms.length && p.perms.every((x) => perms.includes(x)))?.id ?? "custom";
  const tone = light ? "text-ink" : "text-white";
  const sub = light ? "text-slate" : "text-white/55";
  const box = light ? "bg-paper border border-rule" : "bg-white/[0.06]";
  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Moderators for this live" onClick={onClose}>
      <div className={`max-h-[88vh] w-full overflow-y-auto rounded-t-3xl p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl ${light ? "bg-card" : "bg-[#211816]"} ${tone}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-ui text-base font-bold">Moderators for this live</p>
            <p className={`mt-0.5 text-xs ${sub}`}>They help you run the room with what you tick. They can&apos;t act on you, change your settings or name moderators. Up to {ROOM_MODS_MAX}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`rounded-full px-2 text-xl ${sub}`}>×</button>
        </div>
        {staff.length > 0 && (
          <>
            <p className={`mt-4 font-ui text-[11px] font-semibold uppercase tracking-[0.18em] ${sub}`}>Your community&apos;s moderators and admins</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {staff.map((s) => (
                <li key={s.uid}>
                  <button type="button" disabled={has(s.uid)} onClick={() => add({ who: s.uid, name: s.name, avatar: s.avatar, perms: [...MOD_PRESETS[0].perms] })}
                    className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-semibold disabled:opacity-40 ${light ? "border border-rule" : "bg-white/10 hover:bg-white/20"}`}>
                    <Avatar src={s.avatar} alt="" size={24} className="!h-6 !w-6 rounded-full" />{s.name}<span className={sub}>· {s.role}</span>{has(s.uid) ? " ✓" : " +"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); const h = handle.trim().replace(/^@/, "").toLowerCase(); if (h) { add({ who: `@${h}`, name: `@${h}`, perms: [...MOD_PRESETS[0].perms] }); setHandle(""); } }}>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Or name someone: @username" aria-label="Add a moderator by username"
            className={`min-w-0 flex-1 rounded-full px-4 py-2 text-sm focus:outline-none ${light ? "border border-rule bg-paper" : "bg-white/10 text-white placeholder:text-white/40"}`} />
          <button className={`rounded-full px-4 py-2 font-ui text-xs font-bold ${light ? "bg-crimson text-paper" : "bg-white text-ink"}`} disabled={!handle.trim()}>Add moderator</button>
        </form>
        <ul className="mt-4 space-y-2">
          {list.map((m) => (
            <li key={m.who} className={`rounded-2xl p-3 ${box}`}>
              <div className="flex items-center gap-2">
                <Avatar src={m.avatar ?? ""} alt="" size={30} className="!h-[30px] !w-[30px] rounded-full" />
                <button type="button" onClick={() => setOpen(open === m.who ? null : m.who)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{m.name}
                  <span className={`ml-1.5 text-xs font-normal ${sub}`}>{preset(m.perms) === "custom" ? `${m.perms.length} permissions` : MOD_PRESETS.find((p) => p.id === preset(m.perms))!.label}</span></button>
                {MOD_PRESETS.map((p) => (
                  <button key={p.id} type="button" aria-pressed={preset(m.perms) === p.id} onClick={() => set(m.who, [...p.perms])}
                    className={`rounded-full px-2.5 py-1 font-ui text-[11px] font-bold ${preset(m.perms) === p.id ? (light ? "bg-crimson text-paper" : "bg-white text-ink") : light ? "border border-rule" : "bg-white/10"}`}>{p.label}</button>
                ))}
                <button type="button" onClick={() => setList(list.filter((x) => x.who !== m.who))} aria-label={`Remove ${m.name}`} className={`px-1 text-lg ${sub}`}>×</button>
              </div>
              {open === m.who && (
                <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {MOD_PERMS.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 text-xs">
                      <input type="checkbox" checked={m.perms.includes(p.id)} onChange={(e) => set(m.who, e.target.checked ? [...m.perms, p.id] : m.perms.filter((x) => x !== p.id))} className="mt-0.5 h-4 w-4 accent-crimson" />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </li>
          ))}
          {!list.length && <li className={`text-xs ${sub}`}>No moderators yet: you run the room on your own.</li>}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`rounded-full px-4 py-2 text-xs ${sub}`}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => onSave(list)} className={`rounded-full px-5 py-2 font-ui text-xs font-bold ${light ? "bg-crimson text-paper" : "bg-white text-ink"} disabled:opacity-40`}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}
