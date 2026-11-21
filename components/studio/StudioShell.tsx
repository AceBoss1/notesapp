"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { STUDIO_LAYOUTS, type StudioLayout } from "@/lib/studio";

// Media Live Studio PRO (owner, 21 Nov 2026: "I need it to look like streamyard"): the studio's chrome around the programme picture.
// Top bar (name, title, where it goes, Go live / End broadcast), the stage in the middle, the layouts under it, the backstage strip of
// people, the control bar, and a sidebar of tabs on the right (below the stage on a phone). It only lays things out: what each button
// does comes from the screen that uses it (components/community/AudioRoom.tsx in a live, StudioDemo.tsx on /studio), so the room, the
// relay and the rules in lib/studio.ts are untouched.

export const PRODUCT = "Media Live Studio PRO";
export const ring = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF8FA8]";

// ── Icons (drawn here: the app has no icon set) ──
const PATHS: Record<string, ReactNode> = {
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  micOff: <><path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 5 2.2M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18" /></>,
  cam: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
  camOff: <><path d="M10 6h4a2 2 0 0 1 2 2v4l5-3v8M16 16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2M3 3l18 18" /></>,
  screen: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4M12 13V7M9 10l3-3 3 3" /></>,
  invite: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  leave: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
  comments: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" /><path d="M8.5 11h7M8.5 14h4" /></>,
  banners: <><rect x="2" y="13" width="20" height="7" rx="1.5" /><path d="M5 16.5h9M2 9h12M2 5h7" /></>,
  brand: <><path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2A4.5 4.5 0 0 0 21 11c0-4.4-4-8-9-8Z" /><circle cx="7.5" cy="10.5" r="1" /><circle cx="11" cy="7" r="1" /><circle cx="15.5" cy="8" r="1" /></>,
  media: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4M10.5 9.5l4 2.5-4 2.5Z" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>,
  rec: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" fill="currentColor" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  more: <><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
};
export function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof PATHS | string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{PATHS[name]}</svg>;
}

// A tooltip for an icon button: shown on hover and on keyboard focus (the button carries the same words as its accessible name).
function Tip({ text, side = "top" }: { text: string; side?: "top" | "left" | "bottom" }) {
  const pos = side === "left" ? "right-full top-1/2 mr-2 -translate-y-1/2" : side === "bottom" ? "left-1/2 top-full mt-2 -translate-x-1/2" : "bottom-full left-1/2 mb-2 -translate-x-1/2";
  return <span role="tooltip" className={`pointer-events-none absolute z-30 whitespace-nowrap rounded-md bg-black px-2 py-1 font-ui text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${pos}`}>{text}</span>;
}

// ── The layout row under the stage: a little drawing of each layout, like StreamYard's. ──
const LAYOUT_ART: Record<StudioLayout, ReactNode> = {
  solo: <rect x="9" y="3" width="22" height="18" rx="1.5" />,
  auto: <><rect x="3" y="5" width="16" height="14" rx="1.5" /><rect x="21" y="5" width="16" height="14" rx="1.5" /></>,
  grid: <><rect x="6" y="2" width="13" height="9.5" rx="1.2" /><rect x="21" y="2" width="13" height="9.5" rx="1.2" /><rect x="6" y="12.5" width="13" height="9.5" rx="1.2" /><rect x="21" y="12.5" width="13" height="9.5" rx="1.2" /></>,
  spotlight: <><rect x="3" y="3" width="24" height="18" rx="1.5" /><rect x="29" y="3" width="8" height="8.5" rx="1.2" /><rect x="29" y="12.5" width="8" height="8.5" rx="1.2" /></>,
  pip: <><rect x="3" y="3" width="34" height="18" rx="1.5" /><rect x="26" y="13" width="9" height="6" rx="1" fill="currentColor" /></>,
};
// StreamYard's names first, ours (lib/studio.ts) in the tooltip.
const LAYOUT_NAME: Record<StudioLayout, string> = { solo: "Solo", auto: "Side by side", grid: "Group", spotlight: "Leader", pip: "Picture in picture" };
const LAYOUT_ORDER: StudioLayout[] = ["solo", "auto", "grid", "spotlight", "pip"];

export function LayoutBar({ layout, onPick, disabled, screen, busy }: { layout: StudioLayout; onPick?: (l: StudioLayout) => void; disabled?: boolean; screen?: string; busy?: boolean }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]" role="radiogroup" aria-label="Layout">
      {LAYOUT_ORDER.map((id) => {
        const on = layout === id;
        const hint = STUDIO_LAYOUTS.find((l) => l.id === id)?.hint ?? "";
        return (
          <button key={id} type="button" role="radio" aria-checked={on} disabled={disabled || busy || !onPick} onClick={() => onPick?.(id)} title={`${LAYOUT_NAME[id]}: ${hint}`}
            className={`group relative flex shrink-0 flex-col items-center gap-1 rounded-lg border px-2.5 pb-1.5 pt-2 transition ${ring} ${on ? "border-[#E5122F] bg-[#E5122F]/15 text-white" : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/30 hover:bg-white/[0.08] hover:text-white"} disabled:cursor-not-allowed disabled:opacity-50`}>
            <svg viewBox="0 0 40 24" className="h-6 w-10" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">{LAYOUT_ART[id]}</svg>
            <span className="font-ui text-[10.5px] font-semibold leading-none">{LAYOUT_NAME[id]}</span>
          </button>
        );
      })}
      {screen && <span className="ml-1 flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-white/20 px-2.5 py-2 font-ui text-[11px] text-white/70"><Icon name="screen" className="h-4 w-4" />{screen} is sharing: shown full and whole</span>}
    </div>
  );
}

// ── Backstage: everyone in the studio, on stage or waiting. ──
export type Action = { label: string; run: () => void; danger?: boolean };
export type BackstagePerson = {
  uid: string; name: string; avatar: string; stream: MediaStream | null; mirror?: boolean;
  onStage: boolean; badge?: string; micOff?: boolean; talking?: boolean; focus?: boolean; waiting?: string;
  primary?: Action; actions: Action[]; busy?: boolean;
};
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "•";

function Preview({ stream, mirror }: { stream: MediaStream; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" style={mirror ? { transform: "scaleX(-1)" } : undefined} />;
}

// A small menu: opens under its button, closes on Escape or a click outside, and focuses its first item.
export function Menu({ label, actions, className = "", icon = "more", text }: { label: string; actions: Action[]; className?: string; icon?: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const out = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, [open]);
  if (!actions.length) return null;
  const keys = (e: KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); box.current?.querySelector<HTMLButtonElement>("button")?.focus(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const items = [...(box.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      e.preventDefault();
    }
  };
  return (
    <div ref={box} className={/\babsolute\b/.test(className) ? className : `relative ${className}`} onKeyDown={keys}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={label} title={label} onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-1 text-white backdrop-blur hover:bg-black/80 ${ring}`}><Icon name={icon} className="h-4 w-4" />{text && <span className="font-ui text-[11px] font-semibold">{text}</span>}</button>
      {open && (
        <div id={id} role="menu" className="absolute right-0 top-full z-40 mt-1 min-w-[170px] overflow-hidden rounded-lg border border-white/10 bg-[#241b1d] py-1 shadow-2xl">
          {actions.map((a) => <button key={a.label} type="button" role="menuitem" onClick={() => { setOpen(false); a.run(); }} className={`block w-full px-3 py-2 text-left font-ui text-xs font-semibold hover:bg-white/10 focus:bg-white/10 focus:outline-none ${a.danger ? "text-[#FF8A8A]" : "text-white"}`}>{a.label}</button>)}
        </div>
      )}
    </div>
  );
}

function PersonTile({ p }: { p: BackstagePerson }) {
  return (
    <li className={`relative w-[150px] shrink-0 overflow-visible rounded-lg border ${p.onStage ? "border-[#E5122F]/70" : "border-white/10"} bg-[#1c1517]`}>
      <div className={`relative aspect-video overflow-hidden rounded-t-lg bg-[#2a2023] ${p.talking ? "ring-2 ring-[#35C27A] ring-inset" : ""}`}>
        {p.stream ? <Preview stream={p.stream} mirror={p.mirror} /> : (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.avatar ? <img src={p.avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7A0328] font-ui text-sm font-bold">{initials(p.name)}</span>}
          </div>
        )}
        <span className="absolute left-1.5 right-9 top-1.5 flex gap-1 overflow-hidden">
          {p.onStage && <span className="rounded bg-[#E5122F] px-1.5 py-0.5 font-ui text-[9.5px] font-extrabold uppercase tracking-wide">On stage</span>}
          {p.focus && <span className="flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 font-ui text-[9.5px] font-extrabold uppercase tracking-wide text-ink"><Icon name="star" className="h-2.5 w-2.5" />Focus</span>}
          {p.waiting && <span className="rounded bg-[#F5B83D] px-1.5 py-0.5 font-ui text-[9.5px] font-extrabold uppercase tracking-wide text-ink">{p.waiting}</span>}
        </span>
        {p.micOff && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 p-1" title="Microphone off"><Icon name="micOff" className="h-3 w-3 text-[#FF8A8A]" /><span className="sr-only">Microphone off</span></span>}
      </div>
      <Menu label={`More for ${p.name}`} actions={p.actions} className="absolute right-1.5 top-1.5 z-10" />
      <div className="px-2 pb-2 pt-1.5">
        <p className="truncate font-ui text-xs font-bold" title={p.name}>{p.name}</p>
        <p className="truncate text-[10.5px] text-white/50">{p.badge || " "}</p>
        {p.primary && (
          <button type="button" disabled={p.busy} onClick={p.primary.run}
            className={`mt-1.5 w-full rounded-md px-2 py-1.5 font-ui text-[11px] font-bold transition ${ring} ${p.onStage ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-ink hover:bg-white/85"} disabled:opacity-40`}>{p.primary.label}</button>
        )}
      </div>
    </li>
  );
}

export function Backstage({ people, empty = 0, onInvite, inviteHint }: { people: BackstagePerson[]; empty?: number; onInvite?: () => void; inviteHint?: string }) {
  return (
    <section aria-label="Backstage" className="min-w-0">
      <ul className="flex gap-2.5 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:thin]">
        {people.map((p) => <PersonTile key={p.uid} p={p} />)}
        {Array.from({ length: Math.min(empty, 6) }, (_, i) => (
          <li key={`empty-${i}`} className="flex w-[150px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-3 text-center">
            <Icon name="invite" className="h-5 w-5 text-white/40" />
            <span className="text-[10.5px] text-white/45">{inviteHint ?? "An empty seat"}</span>
            {onInvite && <button type="button" onClick={onInvite} className={`rounded-md bg-white/10 px-3 py-1 font-ui text-[11px] font-bold hover:bg-white/20 ${ring}`}>Invite</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── The control bar: round icon buttons with a label under each. ──
export type Control = { id: string; label: string; icon: string; onClick: () => void; active?: boolean; off?: boolean; disabled?: boolean; danger?: boolean; tip?: string; pressed?: boolean; expanded?: boolean };
export function ControlBar({ controls }: { controls: Control[] }) {
  return (
    <div className="flex items-end justify-center gap-0.5 sm:gap-3" role="toolbar" aria-label="Studio controls">
      {controls.map((c) => (
        <button key={c.id} type="button" onClick={c.onClick} disabled={c.disabled} aria-pressed={c.pressed} aria-expanded={c.expanded} aria-label={c.tip ?? c.label}
          className={`group relative flex w-[54px] flex-col items-center gap-1 rounded-lg py-1 font-ui text-[10.5px] font-semibold text-white/80 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-[68px] ${ring}`}>
          <span className={`flex h-11 w-11 items-center justify-center rounded-full transition ${c.danger ? "bg-[#E5122F] text-white group-hover:bg-[#c90f28]" : c.off ? "bg-[#E5122F]/90 text-white group-hover:bg-[#E5122F]" : c.active ? "bg-white text-ink" : "bg-white/10 group-hover:bg-white/20"}`}>
            <Icon name={c.icon} />
          </span>
          <span className="max-w-full truncate">{c.label}</span>
          {c.tip && <Tip text={c.tip} />}
        </button>
      ))}
    </div>
  );
}

// ── The shell ──
export type Tab = { id: string; label: string; icon: string; badge?: number; body: ReactNode };

export default function StudioShell({ title, destination, status, primary, notice, stage, belowStage, layoutBar, backstage, controls, tabs, startTab, embedded, overlay, topExtra }: {
  title: string;
  destination: ReactNode; // where it goes: "NotesApp · …" and what's coming
  status: { live: boolean; time?: string; viewers?: string; recording?: boolean; preview?: string };
  primary?: ReactNode; // the red Go live / End broadcast button
  notice?: ReactNode; stage: ReactNode; belowStage?: ReactNode; layoutBar?: ReactNode; backstage?: ReactNode;
  controls: Control[]; tabs: Tab[]; startTab?: string;
  embedded?: boolean; // inside a page (/studio) rather than over the whole screen (a live)
  overlay?: ReactNode; topExtra?: ReactNode;
}) {
  const [tab, setTab] = useState<string>(startTab ?? tabs[0]?.id ?? "");
  const [open, setOpen] = useState(true); // the sidebar, on a computer
  const tabsRef = useRef<HTMLDivElement>(null);
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  const pick = (id: string) => { if (id === tab) setOpen((v) => !v); else { setTab(id); setOpen(true); } };
  const tabKeys = (e: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const i = tabs.findIndex((t) => t.id === tab);
    const n = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[n].id); setOpen(true);
    tabsRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[n]?.focus();
    e.preventDefault();
  };
  const bar = <ControlBar controls={controls} />;
  return (
    <div className={`${embedded ? "relative rounded-xl2 lg:h-[min(880px,calc(100vh-5rem))]" : "fixed inset-0 z-[130]"} flex flex-col bg-[#120c0d] font-body text-white`}
      role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : true} aria-label={`${PRODUCT}: ${title}`}>
      {/* Top bar */}
      <header className={`flex flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 bg-[#171012] px-3 py-2.5 sm:px-4 ${embedded ? "rounded-t-xl2" : "pt-[calc(env(safe-area-inset-top)_+_0.625rem)]"}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#A6093D] to-[#4E0119]" aria-hidden><Icon name="cam" className="h-4 w-4" /></span>
          <span className="hidden font-ui text-sm font-extrabold tracking-tight sm:inline">Media Live Studio <span className="rounded bg-[#E5122F] px-1 py-px text-[10px] align-middle">PRO</span></span>
        </div>
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate font-ui text-sm font-bold" title={title}>{title}</p>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/55">{destination}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status.recording && <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-ui text-[11px] font-bold text-[#FF8A8A]" role="status"><span className="h-2 w-2 animate-pulse rounded-full bg-[#FF4D4D]" />REC</span>}
          {status.live
            ? <span className="flex items-center gap-1.5 rounded-full bg-[#E5122F] px-2.5 py-1 font-ui text-[11px] font-extrabold tracking-wide" role="status"><span className="h-1.5 w-1.5 rounded-full bg-white" />LIVE{status.time ? ` ${status.time}` : ""}</span>
            : <span className="rounded-full border border-white/20 px-2.5 py-1 font-ui text-[11px] font-bold text-white/70" role="status">{status.preview ?? "Preview"}</span>}
          {status.viewers && <span className="flex items-center gap-1 text-[11px] text-white/60"><Icon name="eye" className="h-3.5 w-3.5" />{status.viewers}</span>}
          {topExtra}
          {primary}
        </div>
      </header>

      <div className={`flex min-h-0 flex-1 flex-col lg:flex-row ${embedded ? "lg:overflow-hidden" : "overflow-y-auto lg:overflow-hidden"}`}>
        {/* The stage, the layouts, backstage and the controls */}
        <main className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1">
          {notice && <div className="flex-none px-3 pt-3 sm:px-4">{notice}</div>}
          <div className="flex-none p-3 sm:px-4 lg:min-h-0 lg:flex-1 lg:[container-type:size]">
            <div className="mx-auto w-full lg:w-[min(100cqw,calc(100cqh*16/9))]">{stage}</div>
          </div>
          {belowStage && <div className="mx-auto w-full max-w-4xl flex-none px-3 sm:px-4">{belowStage}</div>}
          {layoutBar && <div className="flex flex-none justify-center px-3 pt-1 sm:px-4">{layoutBar}</div>}
          {backstage && <div className="flex-none border-t border-white/5 px-2 pt-2 sm:px-3 lg:mt-2">{backstage}</div>}
          <div className="hidden flex-none border-t border-white/10 bg-[#171012] px-3 py-2 lg:block">{bar}</div>
        </main>

        {/* The sidebar: tabs down the right on a computer, across the top of the panel on a phone */}
        <aside className="flex min-h-0 flex-col border-white/10 bg-[#171012] lg:flex-row-reverse lg:border-l" aria-label="Studio sidebar">
          <div ref={tabsRef} role="tablist" aria-label="Studio panels" aria-orientation="vertical" onKeyDown={tabKeys}
            className="flex flex-none gap-1 overflow-x-auto border-y border-white/10 px-2 py-1.5 lg:w-[76px] lg:flex-col lg:overflow-visible lg:border-y-0 lg:border-l lg:px-1.5 lg:py-3">
            {tabs.map((t) => {
              const on = t.id === current?.id;
              return (
                <button key={t.id} type="button" role="tab" id={`nlsp-tab-${t.id}`} aria-selected={on} aria-controls={`nlsp-panel-${t.id}`} tabIndex={on ? 0 : -1} onClick={() => pick(t.id)}
                  className={`group relative flex min-w-[64px] shrink-0 flex-col items-center gap-1 rounded-lg px-1.5 py-2 font-ui text-[10.5px] font-semibold transition ${ring} ${on && open ? "bg-white/10 text-white" : on ? "text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white"}`}>
                  <span className="relative"><Icon name={t.icon} />{!!t.badge && <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E5122F] px-1 text-[9px] font-bold">{t.badge > 99 ? "99+" : t.badge}</span>}</span>
                  {t.label}
                  {on && open && <span className="absolute inset-x-2 -bottom-1.5 h-0.5 rounded bg-[#E5122F] lg:inset-x-auto lg:inset-y-2 lg:-left-1.5 lg:bottom-auto lg:h-auto lg:w-0.5" aria-hidden />}
                </button>
              );
            })}
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? "Hide the sidebar" : "Show the sidebar"}
              className={`group relative mt-auto hidden items-center justify-center rounded-lg py-2 text-white/50 hover:bg-white/[0.06] hover:text-white lg:flex ${ring}`}>
              <Icon name="chevron" className={`h-4 w-4 transition-transform ${open ? "" : "rotate-180"}`} /><Tip text={open ? "Hide the sidebar" : "Show the sidebar"} side="left" />
            </button>
          </div>
          {tabs.map((t) => (
            // Every panel stays mounted (hidden when not chosen), so what is being typed in one isn't lost on switching tabs.
            <section key={t.id} role="tabpanel" id={`nlsp-panel-${t.id}`} aria-labelledby={`nlsp-tab-${t.id}`} hidden={t.id !== current?.id || undefined}
              className={`${t.id !== current?.id ? "hidden" : open ? "flex" : "flex lg:hidden"} h-[70vh] min-h-0 flex-col lg:h-auto lg:w-[360px] xl:w-[380px]`}>
              <h2 className="flex-none border-b border-white/10 px-4 py-3 font-ui text-sm font-bold">{t.label}</h2>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{t.body}</div>
            </section>
          ))}
        </aside>
      </div>

      {/* The controls on a phone: always at the bottom of the screen */}
      <div className={`flex-none border-t border-white/10 bg-[#171012] px-1 py-1.5 lg:hidden ${embedded ? "sticky bottom-0 z-20 rounded-b-xl2" : "pb-[calc(env(safe-area-inset-bottom)_+_0.375rem)]"}`}>{bar}</div>
      {overlay}
    </div>
  );
}

// A panel for Settings and other short choices: over the studio, closes on Escape or outside.
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("button, input, select, textarea")?.focus();
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("keydown", esc); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-[#1c1517] p-4 text-white shadow-2xl sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-ui text-base font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={`rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white ${ring}`}><Icon name="close" className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// One row in Settings: a label, a line under it, and a switch or a button.
export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/10 py-3 first:border-t-0">
      <span className="min-w-0 text-sm"><b className="font-ui font-semibold">{label}</b>{hint && <span className="block text-xs text-white/50">{hint}</span>}</span>
      <span className="shrink-0">{children}</span>
    </div>
  );
}
