"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { updateProfile } from "@/lib/users";
import { notePictureChange } from "@/lib/profile-pictures-client";
import { MOMENTS_LIVE } from "@/lib/moments-rules";
import type { ThreadMessage } from "@/lib/messages-rules";

// One photo or video in a chat: which message and which of its files.
export type MediaItem = { mid: string; i: number; kind: "image" | "video" };
export const mediaKey = (it: Pick<MediaItem, "mid" | "i">) => `${it.mid}/${it.i}`;
export const fileQuery = (cid: string, it: Pick<MediaItem, "mid" | "i">) => `/api/messages/file?cid=${encodeURIComponent(cid)}&mid=${encodeURIComponent(it.mid)}&i=${it.i}`;

// Saves a chat file where you are: the download link is short-lived and sent as an attachment, so following it downloads the
// file and the page stays put, with no new tab showing the link.
export async function saveFile(q: string) {
  const a = document.createElement("a");
  a.href = (await api<{ url: string }>(`${q}&download=1`)).url;
  a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
}

// What the chat lets its viewer and its Media, links and docs panel do, given by Thread. Without it (a viewer opened anywhere
// else) the viewer only shows, swipes and saves.
export type ChatMedia = {
  cid: string;
  meUid: string;
  myAvatar: string;
  messages: ThreadMessage[];
  kept: string[];
  toast: string; // the chat's last "Kept" / "Forwarded" note, shown over the viewer and the panel too
  nameOf: (uid: string) => string;
  keep: (mids: string[], on: boolean) => void;
  forward: (mids: string[]) => void;
  hide: (mids: string[]) => void; // Delete for me, once the person has said yes
  goTo: (mid: string) => void;
  open: (it: MediaItem, firstUrl?: string) => void;
  openLibrary: () => void;
};
export const ChatMediaContext = createContext<ChatMedia | null>(null);
export const useChatMedia = () => useContext(ChatMediaContext);

// "Today, 3:17 pm", "12 Oct, 3:17 pm", "12 Oct 2025, 3:17 pm".
export function when(iso: string) {
  const d = new Date(iso), now = new Date();
  const t = d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true });
  if (d.toDateString() === now.toDateString()) return `Today, ${t}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) })}, ${t}`;
}
export const deleteForMeText = (n: number) => n === 1
  ? "Delete this message for you? It goes from your view of this chat with everything in it; everyone else still sees it."
  : `Delete these ${n} messages for you? They go from your view of this chat with everything in them; everyone else still sees them.`;

// The phone's share sheet takes the file itself, so it is fetched from this site (raw=1), never from a storage link.
export async function fileForSharing(q: string, name: string, type: string): Promise<File> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in first.");
  const r = await fetch(`${q}&raw=1`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store" });
  if (!r.ok) throw new Error("Couldn't get the file ready to share.");
  return new File([await r.blob()], name, { type });
}
export const canShareFiles = () => typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function";

type Option = { label: string; icon: string; onClick: () => void; hint?: string; danger?: boolean; divider?: boolean };

// The chat's photos and videos, full screen inside #NotesApp, like WhatsApp: swipe on a phone, ‹ › or the arrow keys on a
// computer, "2 of 7". Each file's private link is fetched only when it is on screen or next to it, and never shows.
// The top bar says who sent it and when, with ★ Keep, ↪ Forward and ⋮ for everything else (go to the message, share, post as a
// moment, make it your profile picture, save, all media, delete for me). Moments and profile pictures are offered for your own only.
export default function MediaViewer({ cid, items, start, firstUrl, onClose }: { cid: string; items: MediaItem[]; start: number; firstUrl?: string; onClose: () => void }) {
  const chat = useChatMedia();
  const [idx, setIdx] = useState(Math.max(0, start));
  const [urls, setUrls] = useState<Record<string, string>>(() => (firstUrl && items[start] ? { [mediaKey(items[start])]: firstUrl } : {}));
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState("");
  const [shareReady, setShareReady] = useState<File | null>(null); // fetched, but the browser wanted a fresh tap to open the sheet
  const [dx, setDx] = useState(0); // how far a finger has dragged the strip
  const touchX = useRef<number | null>(null);
  const moved = useRef(0); // the drag so far, read when the finger lifts (state may not have re-rendered yet)
  const video = useRef<HTMLVideoElement>(null);
  const n = items.length;
  const at = Math.min(idx, n - 1); // after Delete for me, the next one moves into its place
  const go = (d: number) => { setMore(false); setShareReady(null); setIdx((x) => Math.min(Math.max(Math.min(x, n - 1) + d, 0), n - 1)); };
  const cur = items[at];
  const msg = cur && chat?.messages.find((m) => m.id === cur.mid);
  const file = cur && msg?.attachments?.[cur.i];
  const mine = !!msg && msg.from === chat?.meUid;
  const isKept = !!cur && !!chat?.kept.includes(cur.mid);

  useEffect(() => { if (!n) onClose(); }, [n, onClose]);

  // Load this one and its neighbours, once each (asked is what's already on its way).
  const asked = useRef(new Set<string>());
  useEffect(() => {
    for (const k of [at, at + 1, at - 1]) {
      const it = items[k];
      if (!it || urls[mediaKey(it)] || asked.current.has(mediaKey(it))) continue;
      asked.current.add(mediaKey(it));
      api<{ url: string }>(fileQuery(cid, it)).then((r) => setUrls((u) => ({ ...u, [mediaKey(it)]: r.url }))).catch(() => asked.current.delete(mediaKey(it)));
    }
  }, [at, items, cid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (more) setMore(false); else onClose(); }
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cur) return null;
  const q = fileQuery(cid, cur);
  const say = (text: string, bad = false) => { setNote({ text, bad }); setTimeout(() => setNote(null), 2400); };
  async function run(label: string, f: () => Promise<void>) {
    setMore(false); setBusy(label);
    try { await f(); } catch (e) { say(e instanceof Error ? e.message : "That didn't work.", true); } finally { setBusy(""); }
  }
  const save = () => run("Saving…", () => saveFile(q));
  async function share() {
    if (!file) return;
    if (shareReady) { const f = shareReady; setShareReady(null); await navigator.share({ files: [f] }).catch(() => {}); return; }
    await run("Getting it ready…", async () => {
      const f = await fileForSharing(q, file.name, file.type);
      if (!navigator.canShare({ files: [f] })) { await saveFile(q); say("This phone can't share it, so it was saved instead."); return; }
      // The sheet needs a recent tap; a big file can take longer than that to fetch, so then it asks for one more.
      try { await navigator.share({ files: [f] }); } catch (e) { if (e instanceof Error && e.name === "NotAllowedError") setShareReady(f); }
    });
  }
  const postMoment = () => run("Posting…", async () => {
    if (!confirm(`Post this ${cur.kind === "image" ? "photo" : "video"} as your moment? People who can see your moments will see it until it expires.`)) return;
    const durationSec = cur.kind === "video" ? video.current?.duration : undefined;
    await api("/api/messages/file/reuse", { body: { cid, mid: cur.mid, i: cur.i, to: "moment", ...(durationSec ? { durationSec } : {}) } });
    say("Posted as your moment");
  });
  const makeAvatar = () => run("Updating…", async () => {
    if (!chat || !confirm("Make this photo your profile picture?")) return;
    const r = await api<{ url: string }>("/api/messages/file/reuse", { body: { cid, mid: cur.mid, i: cur.i, to: "avatar" } });
    await updateProfile(chat.meUid, { avatar: r.url });
    await notePictureChange(r.url, chat.myAvatar); // in your picture history, with the one it replaced
    say("It's your profile picture now");
  });
  function deleteForMe() {
    if (!chat || !confirm(deleteForMeText(1))) return;
    setMore(false);
    chat.hide([cur.mid]);
  }

  const options: Option[] = chat ? [
    { label: "Go to message in chat", icon: "💬", onClick: () => { onClose(); chat.goTo(cur.mid); } },
    { label: isKept ? "Remove from kept" : "Keep (favourite)", icon: "★", hint: isKept ? "" : "Saved → From chats", onClick: () => { setMore(false); chat.keep([cur.mid], !isKept); } },
    { label: "Forward to a chat", icon: "↪", divider: true, onClick: () => { onClose(); chat.forward([cur.mid]); } },
    ...(canShareFiles() && file ? [{ label: "Share to another app", icon: "⤴", onClick: share }] : []),
    ...(mine && MOMENTS_LIVE ? [{ label: "Post as my moment", icon: "◎", onClick: postMoment }] : []),
    ...(mine && cur.kind === "image" ? [{ label: "Set as my profile picture", icon: "👤", hint: "photos only", onClick: makeAvatar }] : []),
    { label: canShareFiles() ? "Save to this device" : "Save to this computer", icon: "⬇", divider: true, onClick: save },
    { label: "All media, links and docs", icon: "▦", onClick: () => { onClose(); chat.openLibrary(); } },
    { label: "Delete for me", icon: "🗑", danger: true, divider: true, onClick: deleteForMe },
  ] : [];

  const label = cur.kind === "image" ? "Photo" : "Video";
  const btn = "flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-lg font-semibold hover:bg-white/10 disabled:opacity-40";
  const arrow = "absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl leading-none text-white backdrop-blur hover:bg-white/25 disabled:opacity-0 sm:flex";
  const caption = msg?.text?.trim();
  const shown = note?.text || busy || (chat?.toast ?? "");

  // On document.body, so it sits above the masthead and the chat's own header.
  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col bg-[#0b0b0b] text-white" role="dialog" aria-modal="true" aria-label={n > 1 ? `${label}, ${at + 1} of ${n}` : label}>
      <div className="relative flex items-center gap-1 px-2 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
        <button type="button" onClick={onClose} aria-label="Close" className={`${btn} text-2xl sm:hidden`}>←</button>
        <div className="min-w-0 flex-1 px-1 font-ui">
          <p className="truncate text-sm font-bold">{msg && chat ? chat.nameOf(msg.from) : label}</p>
          <p className="truncate text-xs text-white/70">{msg ? when(msg.createdAt) : ""}{n > 1 && <>{msg ? " · " : ""}{at + 1} of {n}</>}</p>
        </div>
        {chat ? (
          <>
            <button type="button" onClick={() => chat.keep([cur.mid], !isKept)} aria-label={isKept ? "Remove from kept" : "Keep"} aria-pressed={isKept} title={isKept ? "Kept: in Saved → From chats" : "Keep (favourite)"} className={`${btn} ${isKept ? "text-amber-300" : ""}`}>{isKept ? "★" : "☆"}</button>
            <button type="button" onClick={() => { onClose(); chat.forward([cur.mid]); }} aria-label="Forward" title="Forward to a chat" className={btn}>↪</button>
            <button type="button" onClick={() => setMore((v) => !v)} aria-label="More options" aria-haspopup="menu" aria-expanded={more} className={btn}>⋮</button>
          </>
        ) : <button type="button" onClick={save} className={`${btn} text-sm`}>Save</button>}
        <button type="button" onClick={onClose} aria-label="Close" className={`${btn} hidden text-2xl sm:flex`}>×</button>
        {more && (
          <>
            <div className="fixed inset-0 z-20 bg-black/40 sm:bg-transparent" onClick={() => setMore(false)} aria-hidden="true" />
            {/* A sheet from the bottom on a phone; a menu under ⋮ on a computer. */}
            <div role="menu" className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-ink shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-full sm:w-80 sm:rounded-xl sm:py-1.5">
              <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-10 rounded-full bg-rule sm:hidden" />
              {options.map((o) => (
                <div key={o.label}>
                  {o.divider && <hr className="my-1 border-rule" />}
                  <button type="button" role="menuitem" onClick={o.onClick} className={`flex w-full items-center gap-3 px-5 py-3 text-left text-[15px] hover:bg-paper sm:px-4 sm:py-2.5 sm:text-sm ${o.danger ? "text-crimson" : ""}`}>
                    <span aria-hidden="true" className="w-5 text-center">{o.icon}</span>
                    <span className="flex-1">{o.label}</span>
                    {o.hint && <span className="text-[11px] text-slate">{o.hint}</span>}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div
        className="relative flex-1 overflow-hidden"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; moved.current = 0; }}
        onTouchMove={(e) => { if (touchX.current !== null) { moved.current = e.touches[0].clientX - touchX.current; setDx(moved.current); } }}
        onTouchEnd={() => { if (moved.current < -50) go(1); if (moved.current > 50) go(-1); moved.current = 0; setDx(0); touchX.current = null; }}
      >
        <div className="flex h-full w-full transition-transform duration-300 ease-out" style={{ transform: `translateX(calc(${-at * 100}% + ${dx}px))`, transitionDuration: dx ? "0ms" : undefined }}>
          {items.map((it, k) => {
            const url = urls[mediaKey(it)];
            const near = Math.abs(k - at) <= 1;
            return (
              <div key={mediaKey(it)} className="flex h-full w-full shrink-0 items-center justify-center px-4 pb-4">
                {!near ? null : !url ? <p className="text-sm text-white/70">Loading…</p> : it.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="Photo" className="max-h-full max-w-full select-none rounded-lg object-contain" draggable={false} />
                ) : k === at ? (
                  // Only the video on screen is mounted, so one beside it never plays in the background.
                  <video ref={video} src={url} controls autoPlay playsInline controlsList="nodownload" className="max-h-full max-w-full rounded-lg bg-black" />
                ) : <p className="text-sm text-white/70">Video</p>}
              </div>
            );
          })}
        </div>
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} disabled={at === 0} aria-label="Previous" className={`${arrow} left-3`}>‹</button>
            <button type="button" onClick={() => go(1)} disabled={at === n - 1} aria-label="Next" className={`${arrow} right-3`}>›</button>
          </>
        )}
      </div>
      <div className="min-h-[3.5rem] px-6 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
        {n > 1 && n <= 12 && (
          <p aria-hidden="true" className="mb-2 flex justify-center gap-1.5">
            {items.map((it, k) => <span key={mediaKey(it)} className={`h-1.5 rounded-full ${k === at ? "w-4 bg-white" : "w-1.5 bg-white/40"}`} />)}
          </p>
        )}
        {caption && <p className="mx-auto line-clamp-2 max-w-xl text-sm text-white/85">“{caption}”</p>}
        {shareReady && <button type="button" onClick={share} className="mt-2 rounded-full bg-white px-5 py-2 font-ui text-sm font-bold text-ink">Share now</button>}
        {shown && <p role={note?.bad ? "alert" : "status"} className={`mt-2 text-sm font-semibold ${note?.bad ? "text-red-300" : "text-emerald-300"}`}>{shown}</p>}
      </div>
    </div>,
    document.body,
  );
}
