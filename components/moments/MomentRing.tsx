"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { MOMENTS_LIVE } from "@/lib/moments-rules";
import type { MomentView } from "@/lib/moments-server";
import MomentViewer from "./MomentViewer";
import MomentComposer from "./MomentComposer";
import OwnPictureMenu from "./OwnPictureMenu";
import PictureViewer from "@/components/PictureViewer";

// Wraps a profile picture. Tapping it opens their profile pictures (PictureViewer: swipe or ‹ › through past ones). When the
// member has moments you're allowed to see, the picture gets a ring and tapping asks which to open; on your own profile there
// is also an add button. With moments switched off the picture still opens the pictures.
export default function MomentRing({ username, uid, name, isOwn, children, avatar = "", square = false }: { username: string; uid: string; name: string; isOwn: boolean; children: ReactNode; avatar?: string; square?: boolean }) {
  const [menu, setMenu] = useState(false);
  const [pictures, setPictures] = useState(false);
  const [choose, setChoose] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [moments, setMoments] = useState<MomentView[]>([]);
  const [viewing, setViewing] = useState(false);
  const [composing, setComposing] = useState(false);

  useEffect(() => (MOMENTS_LIVE ? onAuthStateChanged(auth, setUser) : undefined), []);
  const load = useCallback(() => {
    if (!user) return;
    api<{ moments: MomentView[] }>(`/api/moments?username=${encodeURIComponent(username)}`).then((r) => setMoments(r.moments)).catch(() => setMoments([]));
  }, [user, username]);
  useEffect(() => { load(); }, [load]);

  const viewer = pictures && <PictureViewer uid={uid} name={name} current={avatar} isOwn={isOwn} onClose={() => setPictures(false)} />;
  if (!MOMENTS_LIVE || !user) {
    return (
      <>
        <button type="button" onClick={() => setPictures(true)} aria-label={`View ${name}'s profile pictures`} className="block shrink-0 rounded-2xl">{children}</button>
        {viewer}
      </>
    );
  }
  const has = moments.length > 0;
  return (
    <>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => (has ? setChoose(true) : setPictures(true))}
          aria-label={has ? `View @${username}'s moments or profile pictures` : `View ${name}'s profile pictures`}
          className={`block rounded-2xl p-[3px] ${has ? "bg-gradient-to-tr from-crimson via-crimson-bright to-amber-400" : ""}`}
        >
          <span className="block rounded-2xl bg-white p-[2px]">{children}</span>
        </button>
        {isOwn && (
          <button type="button" onClick={() => setMenu(true)} aria-label="Your profile picture and moments" className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-crimson text-lg font-bold leading-none text-white shadow">+</button>
        )}
      </div>
      {choose && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" onClick={() => setChoose(false)}>
          <div className="grid w-full max-w-xs gap-2 rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => { setChoose(false); setViewing(true); }} className="rounded-xl border border-rule px-4 py-3 text-left text-sm font-semibold text-ink hover:border-crimson">✨ View moments</button>
            <button type="button" onClick={() => { setChoose(false); setPictures(true); }} className="rounded-xl border border-rule px-4 py-3 text-left text-sm font-semibold text-ink hover:border-crimson">👤 View profile pictures</button>
          </div>
        </div>
      )}
      {viewer}
      {viewing && has && <MomentViewer moments={moments} onClose={() => { setViewing(false); load(); }} onChanged={load} />}
      {menu && <OwnPictureMenu avatar={avatar} square={square} hasMoments={has} onViewMoments={() => setViewing(true)} onAddMoment={() => setComposing(true)} onAvatarChanged={() => window.location.reload()} onClose={() => setMenu(false)} />}
      {composing && <MomentComposer onClose={() => setComposing(false)} onPosted={load} />}
    </>
  );
}
