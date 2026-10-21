"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ProfilePicture } from "@/lib/profile-pictures";
import { notePictureChange, picturesOf, removeOldPicture } from "@/lib/profile-pictures-client";
import { updateProfile } from "@/lib/users";
import Avatar from "@/components/Avatar";

const when = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : "");

// A member's profile pictures, newest first, like Facebook's: full screen, swipe on a phone, ‹ › (or the arrow keys) on a
// computer, the date and "2 of 5". The owner gets ⋮ on each picture: make an old one their profile picture again, save it,
// change it for a new one, or take an old one out of their history. `onAvatarChanged` tells the page that opened it; without
// one, the page reloads on close so the new picture shows.
export default function PictureViewer({ uid, name, current, isOwn = false, onClose, onAvatarChanged }: { uid: string; name: string; current: string; isOwn?: boolean; onClose: () => void; onAvatarChanged?: (url: string) => void }) {
  const [pics, setPics] = useState<ProfilePicture[] | null>(null);
  const [cur, setCur] = useState(current); // the picture in use, which the owner can change from here
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [i, setI] = useState(0);
  const [dx, setDx] = useState(0); // how far a finger has dragged the picture
  const [error, setError] = useState("");
  const start = useRef<number | null>(null);
  const moved = useRef(0); // the drag so far, read when the finger lifts (state may not have re-rendered yet)
  useEffect(() => { picturesOf(uid, current).then(setPics); }, [uid, current]);
  const close = () => { if (cur !== current && !onAvatarChanged) window.location.reload(); else onClose(); };
  const n = pics?.length ?? 0;
  const go = (d: number) => setI((x) => Math.min(Math.max(x + d, 0), Math.max(n - 1, 0)));
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { if (more) setMore(false); else close(); } if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(p: ProfilePicture) {
    setError(""); setMore(false);
    if (!confirm("Remove this picture from your history? Nobody will see it in your profile pictures any more.")) return;
    try { await removeOldPicture(p.id); setPics((l) => (l ?? []).filter((x) => x.id !== p.id)); setI((x) => Math.max(0, Math.min(x, n - 2))); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't remove it."); }
  }
  // An old picture back as the profile picture: the same address, so nothing is uploaded again, and the history keeps its place.
  async function makeCurrent(q: ProfilePicture) {
    setError(""); setMore(false); setBusy(true);
    try {
      await updateProfile(uid, { avatar: q.url });
      await notePictureChange(q.url, cur);
      setCur(q.url); onAvatarChanged?.(q.url);
      setNote("It's your profile picture again"); setTimeout(() => setNote(""), 2400);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't change your picture."); }
    finally { setBusy(false); }
  }
  // Saves the picture where you are; if the browser can't fetch it (another site's image), it opens in a new tab instead.
  async function save(q: ProfilePicture) {
    setMore(false);
    try {
      const blob = await (await fetch(q.url, { mode: "cors" })).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `profile-picture${q.createdAt ? `-${q.createdAt.slice(0, 10)}` : ""}.${(blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg")}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { window.open(q.url, "_blank", "noopener"); }
  }
  const p = pics?.[i];
  const inUse = !!p && p.url === cur;
  const options: { label: string; icon: string; onClick: () => void; danger?: boolean; hint?: string }[] = isOwn && p ? [
    ...(!inUse ? [{ label: "Make this my profile picture", icon: "👤", onClick: () => void makeCurrent(p) }] : []),
    { label: "Save to this device", icon: "⬇", onClick: () => void save(p) },
    { label: "Change profile picture", icon: "📷", hint: "upload a new one", onClick: () => { window.location.href = "/profile/edit"; } },
    ...(!inUse && p.id ? [{ label: "Remove from history", icon: "🗑", danger: true, onClick: () => void remove(p) }] : []),
  ] : [];
  const arrow = "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl leading-none text-white backdrop-blur hover:bg-white/25 disabled:opacity-0";

  // On document.body, so it sits above the masthead and banners whatever card it was opened from.
  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col bg-[#0b0b0b] text-white" role="dialog" aria-modal="true" aria-label={`${name}'s profile pictures`}>
      <div className="relative flex items-center gap-2 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <p className="truncate font-ui text-sm font-bold">{name}</p>
          <p className="text-xs text-white/70">{p ? `${inUse && isOwn ? "Your profile picture now" : "Profile picture"}${p.createdAt ? ` · ${when(p.createdAt)}` : ""}` : "Profile pictures"}{n > 1 ? ` · ${i + 1} of ${n}` : ""}</p>
        </div>
        {isOwn && p && !inUse && <button type="button" disabled={busy} onClick={() => void makeCurrent(p)} className="hidden rounded-full border border-white/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50 sm:block">{busy ? "Changing…" : "Make profile picture"}</button>}
        {options.length > 0 && <button type="button" onClick={() => setMore((v) => !v)} aria-label="Picture options" aria-haspopup="menu" aria-expanded={more} className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold hover:bg-white/10">⋮</button>}
        <button type="button" onClick={close} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none hover:bg-white/10">×</button>
        {more && (
          <>
            <div className="fixed inset-0 z-20 bg-black/40 sm:bg-transparent" onClick={() => setMore(false)} aria-hidden="true" />
            {/* A sheet from the bottom on a phone; a menu under ⋮ on a computer (as in the chat viewer). */}
            <div role="menu" className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-ink shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-full sm:w-80 sm:rounded-xl sm:py-1.5">
              <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-10 rounded-full bg-rule sm:hidden" />
              {options.map((o) => (
                <button key={o.label} type="button" role="menuitem" onClick={o.onClick} className={`flex w-full items-center gap-3 px-5 py-3 text-left text-[15px] hover:bg-paper sm:px-4 sm:py-2.5 sm:text-sm ${o.danger ? "text-crimson" : ""}`}>
                  <span aria-hidden="true" className="w-5 text-center">{o.icon}</span>
                  <span className="flex-1">{o.label}</span>
                  {o.hint && <span className="text-[11px] text-slate">{o.hint}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onTouchStart={(e) => { start.current = e.touches[0].clientX; moved.current = 0; }}
        onTouchMove={(e) => { if (start.current !== null) { moved.current = e.touches[0].clientX - start.current; setDx(moved.current); } }}
        onTouchEnd={() => { if (moved.current < -50) go(1); if (moved.current > 50) go(-1); moved.current = 0; setDx(0); start.current = null; }}
      >
        {pics === null ? <p className="text-sm text-white/70">Loading…</p> : n === 0 ? (
          <Avatar src={current} alt={name} size={240} />
        ) : (
          <div className="flex h-full w-full transition-transform duration-300 ease-out" style={{ transform: `translateX(calc(${-i * 100}% + ${dx}px))`, transitionDuration: dx ? "0ms" : undefined }}>
            {pics.map((q) => (
              <div key={q.id || q.url} className="flex h-full w-full shrink-0 items-center justify-center px-4 pb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.url} alt={`${name}'s profile picture`} className="max-h-full max-w-full select-none rounded-lg object-contain" draggable={false} />
              </div>
            ))}
          </div>
        )}
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Newer picture" className={`${arrow} left-3`}>‹</button>
            <button type="button" onClick={() => go(1)} disabled={i === n - 1} aria-label="Older picture" className={`${arrow} right-3`}>›</button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="flex justify-center gap-1.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {pics!.map((q, k) => <button key={q.id || q.url} type="button" onClick={() => setI(k)} aria-label={`Picture ${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-1.5 bg-white/40"}`} />)}
        </div>
      )}
      {error && <p role="alert" className="pb-4 text-center text-sm text-red-300">{error}</p>}
      {note && <p role="status" className="pb-4 text-center text-sm font-semibold text-emerald-300">{note}</p>}
    </div>,
    document.body,
  );
}
