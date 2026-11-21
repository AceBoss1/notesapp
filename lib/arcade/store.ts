"use client";

// Where the Arcade keeps a player's wins, records and choices (owner, 20–21 Nov 2026). Playing is free without signing in: a guest's
// progress lives only in this page and starts afresh on every load. A signed-in #NotesApp member's progress is loaded from their account
// when the page opens and saved back shortly after each change (/api/arcade/progress; arcadeProgress/{uid}). Same getItem/setItem shape
// as localStorage, so the games don't know the difference. N$, scores and referral credit through the Notes Life wallet come later;
// no game pays real naira.
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export type ArcadeAccount = { status: "loading" | "guest" | "member"; name?: string; saving?: boolean; error?: string };

const memory = new Map<string, string>();
const pending = new Map<string, string>();
const listeners = new Set<(a: ArcadeAccount) => void>();
let account: ArcadeAccount = { status: "loading" };
let user: User | null = null;
let lastToken = "";
let timer: ReturnType<typeof setTimeout> | null = null;
let readyResolve: (() => void) | null = null;
const ready = new Promise<void>((r) => { readyResolve = r; });
let started = false;

function set(next: Partial<ArcadeAccount>) {
  account = { ...account, ...next };
  listeners.forEach((fn) => fn(account));
}

async function token(): Promise<string> {
  if (!user) return "";
  lastToken = await user.getIdToken().catch(() => lastToken);
  return lastToken;
}

async function flush(keepalive = false) {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!user || !pending.size) return;
  const kv = Object.fromEntries(pending);
  pending.clear();
  set({ saving: true });
  try {
    const t = keepalive ? lastToken : await token();
    const r = await fetch("/api/arcade/progress", { method: "POST", keepalive, headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ kv }) });
    if (!r.ok) throw new Error();
    set({ saving: false, error: undefined });
  } catch {
    Object.entries(kv).forEach(([k, v]) => { if (!pending.has(k)) pending.set(k, v); }); // try again with the next change
    set({ saving: false, error: "Couldn't save just now; we'll try again." });
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  setTimeout(() => readyResolve?.(), 4000); // never hold a game up for long
  window.addEventListener("pagehide", () => { void flush(true); });
  onAuthStateChanged(auth, async (u) => {
    user = u;
    if (!u) { set({ status: "guest", name: undefined }); readyResolve?.(); return; }
    set({ status: "loading", name: u.displayName || u.email || "you" });
    try {
      const r = await fetch("/api/arcade/progress", { headers: { Authorization: `Bearer ${await token()}` } });
      const j = r.ok ? await r.json() : { kv: {} };
      // What's saved wins over this page's guest play, except for keys only played here (kept, and saved now).
      Object.entries((j.kv || {}) as Record<string, string>).forEach(([k, v]) => memory.set(k, v));
      memory.forEach((v, k) => { if (!(k in (j.kv || {}))) pending.set(k, v); });
      set({ status: "member", error: undefined });
      if (pending.size) void flush();
    } catch {
      set({ status: "member", error: "Couldn't load your saved progress." });
    }
    readyResolve?.();
  });
}

export const arcadeStore = {
  getItem(key: string): string | null {
    return memory.has(key) ? (memory.get(key) as string) : null;
  },
  setItem(key: string, value: string): void {
    memory.set(key, value);
    if (!user) return;
    pending.set(key, value);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), 800);
  },
};

// The frame waits for this before showing a game, so a member's saved wins are there when the game first reads them.
export function arcadeReady(): Promise<void> {
  start();
  return ready;
}

export function subscribeArcadeAccount(fn: (a: ArcadeAccount) => void): () => void {
  start();
  listeners.add(fn);
  fn(account);
  return () => { listeners.delete(fn); };
}
