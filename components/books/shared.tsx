"use client";

import type { User } from "firebase/auth";
import type { ReactNode } from "react";
import { methodLabel, naira, type Entry } from "@/lib/books";

// Shared pieces of the Business books screens (/profile/books): the API call, money, tiles, badges, the sheet and the icons.
export type Api = <T = Record<string, unknown>>(path: string, body?: Record<string, unknown>) => Promise<T>;
export function makeApi(user: User, owner: string): Api {
  return async (path, body) => {
    const url = body ? "/api/books" : `/api/books?${path}${owner ? `&owner=${encodeURIComponent(owner)}` : ""}`;
    const res = await fetch(url, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, ...(body ? { body: JSON.stringify({ ...body, ...(owner ? { owner } : {}) }) } : {}) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(j.error || "Something went wrong."), { code: j.code, status: res.status });
    return j;
  };
}
export const newClientId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
export const field = "w-full rounded-xl border border-rule bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-crimson";
export const pill = "inline-flex items-center justify-center gap-2 rounded-full border border-rule bg-card px-4 py-2 font-ui text-sm font-semibold text-ink hover:border-crimson disabled:opacity-40";
export const Money = ({ kobo, className = "" }: { kobo: number; className?: string }) => <span className={`tabular-nums ${className}`}>{naira(kobo)}</span>;
export const nairaInput = (v: string) => { const s = v.replace(/[₦,\s]/g, ""); if (!/^\d+(\.\d{0,2})?$/.test(s)) return null; const [w, f = ""] = s.split("."); return Number(w) * 100 + Number((f + "00").slice(0, 2)); };
export const koboToInput = (k: number) => (k % 100 ? (k / 100).toFixed(2) : String(k / 100));

export function Eyebrow({ children }: { children: ReactNode }) { return <p className="eyebrow">{children}</p>; }
export function Tile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "late" }) {
  return (
    <div className="card p-4">
      <p className={`font-mono text-[11px] uppercase tracking-eyebrow ${tone === "late" ? "text-red-700" : "text-crimson"}`}>{label}</p>
      <p className={`mt-1.5 font-ui text-2xl font-bold ${tone === "late" ? "text-red-700" : "text-ink"}`}>{value}</p>
      {sub && <p className="mt-1 text-[13px] leading-snug text-slate">{sub}</p>}
    </div>
  );
}
export function Badge({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "owes" | "store" | "late" | "void" }) {
  const c = { plain: "bg-field text-ink", owes: "bg-amber-100 text-amber-800", store: "bg-crimson/10 text-crimson", late: "bg-red-100 text-red-700", void: "bg-field text-slate line-through" }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}
// How an entry shows in a list: the badge and the line under its title.
export function entryBadge(e: Pick<Entry, "kind" | "source" | "method" | "owesKobo" | "settledKobo" | "voidedAt">) {
  if (e.voidedAt) return <Badge tone="void">Voided</Badge>;
  if (e.kind === "refund") return <Badge tone="late">Refund</Badge>;
  if (e.kind === "payment" && e.source === "online") return <Badge tone="store">Paid back · online</Badge>;
  if (e.source === "online") return <Badge tone="store">Store</Badge>;
  if (e.kind === "payment") return <Badge>Paid back · {methodLabel(e.method)}</Badge>;
  if (e.kind === "opening") return <Badge tone="owes">Owes</Badge>;
  if (e.kind === "sale" && e.owesKobo - (e.settledKobo || 0) > 0) return <Badge tone="owes">Owes</Badge>;
  return <Badge>{methodLabel(e.method)}</Badge>;
}
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }).toLowerCase();

// A sheet: from the bottom on phones, a dialog on bigger screens. Escape or the × closes it.
export function Sheet({ title, eyebrow, onClose, children, wide }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => e.key === "Escape" && onClose()} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`max-h-[94vh] w-full overflow-y-auto rounded-t-3xl border border-rule bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-7 ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-rule sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div>{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}<h2 className="mt-1 font-display text-3xl text-ink">{title}</h2></div>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-field text-ink hover:text-crimson"><Icon name="close" /></button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

const PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  bag: "M6 7h12l1 13H5zM9 7V5a3 3 0 0 1 6 0v2",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  box: "M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M17 8v6M14 11h6",
  chart: "M4 20V10M10 20V4M16 20v-7M2 20h20",
  download: "M12 3v12M7 10l5 5 5-5M4 20h16",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  file: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  chat: "M4 5h16v11H8l-4 4z",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  lock: "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3",
  cloud: "M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z",
  minus: "M5 12h14",
  check: "M5 12l5 5 9-10",
  print: "M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7z",
  camera: "M4 7h3l2-2h6l2 2h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
};
export function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof PATHS | string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={PATHS[name] ?? ""} /></svg>;
}
export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>;
}
// Save text as a file (CSV exports and templates).
export function download(name: string, text: string, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
