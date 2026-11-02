"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Icon } from "@/lib/agents/scopes";

// Small pieces shared by the agent-layer screens (Connect NotesApp, Nana's inbox, Console → Connected agents), drawn to the approved
// mockups.

const PATHS: Record<Icon, string> = {
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  calendar: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  bag: "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  chat: "M4 5h16v11H9l-5 4z",
  pen: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3",
  up: "M12 19V5M6 11l6-6 6 6",
  reply: "M4 5h16v11H9l-5 4zM9 10h6",
  tag: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01",
  truck: "M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01",
  lock: "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3",
};
export function Glyph({ icon, className = "h-4 w-4" }: { icon: Icon; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={PATHS[icon]} /></svg>;
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? "bg-crimson" : "bg-rule"}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-card shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

// A coloured initial for an assistant or a person (the mockups' "C", "TB", "CE").
const TONES = ["bg-[#C2603E]", "bg-[#2E6B57]", "bg-[#3B4C8F]", "bg-[#3A3A3A]", "bg-[#8A4B8F]", "bg-[#B5482D]"];
export function Initials({ name, size = 40, rounded = "rounded-full" }: { name: string; size?: number; rounded?: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const text = (parts.length > 1 && size >= 36 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?")[0]).toUpperCase();
  const tone = TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];
  return <span className={`inline-flex shrink-0 items-center justify-center font-ui font-bold text-white ${tone} ${rounded}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">{text}</span>;
}
export function NanaFace({ size = 40 }: { size?: number }) {
  return <Image src="/images/nana/nana-sm.webp" alt="" width={size} height={size} className="shrink-0 rounded-full bg-field object-contain" style={{ width: size, height: size }} />;
}

// The bare header of the Connect and link pages (also served on the mcp. address, where the site's menus don't belong): the mark and
// the address being viewed.
export function AgentShell({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);
  return (
    <div className="min-h-[100dvh] bg-paper text-ink">
      <header className="border-b border-rule bg-card">
        <div className="mx-auto flex max-w-[1120px] items-center gap-2.5 px-4 py-3 lg:px-8 lg:py-3.5">
          <Link href="/" className="flex items-center gap-2.5"><Image src="/images/brand/icon-192.png" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-[9px]" /><span className="font-ui text-[15px] font-extrabold">Notes<span className="text-crimson">App</span></span></Link>
          {host && <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-field px-3 py-1 font-mono text-xs text-slate"><Glyph icon="lock" className="h-3 w-3" />{host}</span>}
        </div>
      </header>
      {children}
    </div>
  );
}

export function CopyButton({ value, className = "" }: { value: string; className?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" onClick={() => navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })} className={`font-ui text-xs font-bold text-crimson ${className}`}>{done ? "Copied" : "Copy"}</button>;
}

export const kindTone: Record<string, string> = { book: "text-crimson", q: "text-[#1E4E8C]", agent: "text-[#5B3A9E]", ship: "text-moss", money: "text-[#8A5A00]", done: "text-moss" };
