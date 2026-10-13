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

// Wraps a profile picture. When the member has moments you're allowed to see, the picture gets a ring and opens the viewer;
// on your own profile there is also an add button. With the feature switched off this renders the picture and nothing else.
export default function MomentRing({ username, isOwn, children, avatar = "", square = false }: { username: string; isOwn: boolean; children: ReactNode; avatar?: string; square?: boolean }) {
  const [menu, setMenu] = useState(false);
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

  if (!MOMENTS_LIVE || !user) return <>{children}</>;
  const has = moments.length > 0;
  return (
    <>
      <div className="relative shrink-0">
        <button
          type="button"
          disabled={!has}
          onClick={() => setViewing(true)}
          aria-label={has ? `View @${username}'s moments` : undefined}
          className={`block rounded-2xl p-[3px] ${has ? "bg-gradient-to-tr from-crimson via-crimson-bright to-amber-400" : ""}`}
        >
          <span className="block rounded-2xl bg-white p-[2px]">{children}</span>
        </button>
        {isOwn && (
          <button type="button" onClick={() => setMenu(true)} aria-label="Your profile picture and moments" className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-crimson text-lg font-bold leading-none text-white shadow">+</button>
        )}
      </div>
      {viewing && has && <MomentViewer moments={moments} onClose={() => { setViewing(false); load(); }} onChanged={load} />}
      {menu && <OwnPictureMenu avatar={avatar} square={square} hasMoments={has} onViewMoments={() => setViewing(true)} onAddMoment={() => setComposing(true)} onAvatarChanged={() => window.location.reload()} onClose={() => setMenu(false)} />}
      {composing && <MomentComposer onClose={() => setComposing(false)} onPosted={load} />}
    </>
  );
}
