"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CHAT_COLOURS, chatBackgroundStyle, type ChatBackground } from "@/lib/chat-background";
import { useChatBackground, useNight } from "@/lib/chat-background-client";
import { uploadToR2 } from "@/lib/upload";

// Choose what's behind your chats: the African pattern, plain, a colour or your own picture. Pro, Business and Enterprise; on other
// plans the choices show with a lock and Unlock.
export default function ChatBackgroundPicker() {
  const [bg, allowed, save] = useChatBackground();
  const night = useNight();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const same = (a: ChatBackground, b: ChatBackground) => JSON.stringify(a) === JSON.stringify(b);
  async function choose(next: ChatBackground) {
    setError("");
    try { await save(next); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); }
  }
  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy(true); setError("");
    try { await choose({ kind: "picture", url: await uploadToR2(f, "chat") }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't upload that picture."); }
    finally { setBusy(false); if (file.current) file.current.value = ""; }
  }
  const options: { label: string; bg: ChatBackground }[] = [
    { label: "African pattern", bg: { kind: "pattern" } },
    { label: "Plain", bg: { kind: "plain" } },
    ...CHAT_COLOURS.map((c) => ({ label: c.label, bg: { kind: "colour" as const, id: c.id } })),
  ];
  const tile = (o: { label: string; bg: ChatBackground }) => {
    const look = chatBackgroundStyle(o.bg, night);
    const on = same(bg, o.bg);
    return (
      <button key={o.label} type="button" disabled={!allowed || busy} onClick={() => choose(o.bg)} aria-pressed={on}
        className={`overflow-hidden rounded-xl border text-left disabled:cursor-not-allowed ${on ? "border-crimson ring-2 ring-crimson/40" : "border-rule"}`}>
        <span className={`block h-16 ${look.className}`} style={look.style} />
        <span className="block bg-card px-2 py-1.5 font-ui text-xs font-semibold text-ink">{o.label}</span>
      </button>
    );
  };
  return (
    <div>
      {!allowed && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-field px-3 py-2">
          <p className="text-sm text-slate">🔒 Your own chat background comes with Pro, Business and Enterprise.</p>
          <Link href="/pricing" className="shrink-0 rounded-full bg-gradient-to-r from-crimson to-crimson-bright px-4 py-1.5 font-ui text-xs font-bold text-white">Unlock</Link>
        </div>
      )}
      <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${allowed ? "" : "opacity-60"}`}>
        {options.map(tile)}
        <button type="button" disabled={!allowed || busy} onClick={() => file.current?.click()} aria-pressed={bg.kind === "picture"}
          className={`overflow-hidden rounded-xl border text-left disabled:cursor-not-allowed ${bg.kind === "picture" ? "border-crimson ring-2 ring-crimson/40" : "border-dashed border-rule"}`}>
          {bg.kind === "picture"
            ? <span className={`block h-16 ${chatBackgroundStyle(bg, night).className}`} style={chatBackgroundStyle(bg, night).style} />
            : <span className="flex h-16 items-center justify-center text-2xl" aria-hidden>🖼️</span>}
          <span className="block bg-card px-2 py-1.5 font-ui text-xs font-semibold text-ink">{busy ? "Uploading…" : bg.kind === "picture" ? "Change your picture" : "Your own picture"}</span>
        </button>
      </div>
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      {error && <p className="mt-2 text-sm text-crimson" role="alert">{error}</p>}
      <p className="mt-2 text-xs text-slate">Only you see it, in every chat, on every device. A soft wash goes over a picture so messages stay easy to read, by Day and by Night.</p>
    </div>
  );
}
