"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { uploadToR2 } from "@/lib/upload";
import { updateProfile } from "@/lib/users";
import PictureViewer from "@/components/PictureViewer";
import { notePictureChange } from "@/lib/profile-pictures-client";

// What tapping + on your own picture offers, so a new profile picture and a moment can't be mixed up:
// view or change the profile picture (stays until you change it), and view or add moments (gone after 24 to 72 hours).
export default function OwnPictureMenu({ avatar, square = false, hasMoments, onViewMoments, onAddMoment, onAvatarChanged, onClose }: {
  avatar: string; square?: boolean; hasMoments: boolean; onViewMoments: () => void; onAddMoment: () => void; onAvatarChanged?: (url: string) => void; onClose: () => void;
}) {
  const [viewing, setViewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(avatar);
  const pick = useRef<HTMLInputElement>(null);

  async function change(file: File | undefined) {
    const uid = auth.currentUser?.uid;
    if (!file || !uid) return;
    if (!file.type.startsWith("image/")) { setError("Choose a picture (JPG, PNG or WebP)."); return; }
    setBusy(true); setError("");
    try {
      const url = await uploadToR2(file, "avatar");
      await updateProfile(uid, { avatar: url });
      await notePictureChange(url, current); // keeps the new picture, and the one it replaced, in your picture history
      setCurrent(url); onAvatarChanged?.(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't change your picture."); }
    finally { setBusy(false); if (pick.current) pick.current.value = ""; }
  }

  const btn = "flex w-full items-center gap-3 rounded-xl border border-rule px-4 py-3 text-left text-sm font-semibold text-ink hover:border-crimson disabled:opacity-50";
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Your picture and moments" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">Your picture and moments</h2>
          <button onClick={onClose} aria-label="Close" className="px-2 text-2xl leading-none text-slate">×</button>
        </div>
        <div className="mt-4 grid gap-2">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-slate">Profile picture · stays until you change it</p>
          <button type="button" className={btn} onClick={() => setViewing(true)}><span aria-hidden>👤</span>View profile pictures</button>
          <button type="button" className={btn} disabled={busy} onClick={() => pick.current?.click()}><span aria-hidden>📷</span>{busy ? "Uploading…" : "Update profile picture"}</button>
          <input ref={pick} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => change(e.target.files?.[0])} />
          <p className="mt-2 font-mono text-[11px] uppercase tracking-eyebrow text-slate">Moments · disappear after 24 to 72 hours</p>
          <button type="button" className={btn} disabled={!hasMoments} onClick={() => { onClose(); onViewMoments(); }}><span aria-hidden>✨</span>{hasMoments ? "View my moments" : "No moments up right now"}</button>
          <button type="button" className={btn} onClick={() => { onClose(); onAddMoment(); }}><span aria-hidden>＋</span>Add a moment</button>
        </div>
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        {viewing && auth.currentUser && <PictureViewer uid={auth.currentUser.uid} name="Your profile pictures" current={current} isOwn onClose={() => setViewing(false)} />}
        <p className="mt-4 text-xs text-slate">Want to change your name, bio or links too? <Link href="/profile/edit" className="text-crimson underline" onClick={onClose}>Edit profile</Link></p>
      </div>
    </div>
  );
}
