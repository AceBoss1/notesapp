"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { auth } from "@/lib/firebase";
import { DEFAULT_CHAT_BACKGROUND, cleanChatBackground, type ChatBackground } from "@/lib/chat-background";
import { THEME_EVENT } from "@/lib/theme";

// Your chat background (lib/chat-background.ts): saved on your account, with a copy on this device so chats open with it straight away.
const KEY = "notesapp:chatBackground";
type State = { bg: ChatBackground; allowed: boolean };
let current: State | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(s: State) => void>();
const set = (s: State) => { current = s; listeners.forEach((f) => f(s)); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

function load() {
  if (current === null) {
    try { const s = JSON.parse(localStorage.getItem(KEY) ?? "null"); const bg = cleanChatBackground(s?.bg); if (bg) current = { bg, allowed: s.allowed === true }; } catch {}
  }
  // Wait until sign-in has settled: asked any earlier, the request goes out without the member and the saved choice never arrives.
  loading ??= auth.authStateReady()
    .then(() => (auth.currentUser ? api<{ chatBackground?: unknown; chatBackgroundAllowed?: boolean }>("/api/messages/prefs") : null))
    .then((r) => { if (r) set({ bg: cleanChatBackground(r.chatBackground) ?? DEFAULT_CHAT_BACKGROUND, allowed: r.chatBackgroundAllowed === true }); else loading = null; })
    .catch(() => { loading = null; });
}

export function useChatBackground(): [ChatBackground, boolean, (next: ChatBackground) => Promise<void>] {
  const [s, setS] = useState<State>(() => current ?? { bg: DEFAULT_CHAT_BACKGROUND, allowed: false });
  useEffect(() => {
    load();
    if (current) setS(current);
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  async function save(next: ChatBackground) {
    const before = current ?? s;
    set({ ...before, bg: next });
    try { await api("/api/messages/prefs", { body: { chatBackground: next } }); }
    catch (e) { set(before); throw e; }
  }
  return [s.bg, s.allowed, save];
}

// Whether the page is showing Night right now (lib/theme.ts), kept up to date.
export function useNight(): boolean {
  const [night, setNight] = useState(false);
  useEffect(() => {
    const on = () => setNight(document.documentElement.getAttribute("data-theme") === "night");
    on();
    const obs = new MutationObserver(on);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener(THEME_EVENT, on);
    return () => { obs.disconnect(); window.removeEventListener(THEME_EVENT, on); };
  }, []);
  return night;
}
