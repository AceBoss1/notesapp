"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { MOMENTS_LIVE } from "@/lib/moments-rules";
import type { MomentGroup } from "@/lib/moments-server";
import Avatar from "@/components/Avatar";
import MomentViewer from "./MomentViewer";
import MomentComposer from "./MomentComposer";

type Me = { uid: string; username: string; displayName: string; avatar: string };

// What a tile shows behind the avatar: the newest moment's picture or text (a video shows a play mark: we don't keep a still of it).
function Preview({ group }: { group: MomentGroup | undefined }): ReactNode {
  const latest = group?.moments[group.moments.length - 1];
  if (latest?.kind === "image" && latest.imageUrl) return <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${latest.imageUrl})` }} aria-hidden />;
  if (latest?.kind === "text") return <div className="absolute inset-0 bg-gradient-to-br from-crimson to-crimson-deep p-3 pt-14 text-[11px] leading-snug text-white/90" aria-hidden><span className="line-clamp-4">{latest.text}</span></div>;
  if (latest?.kind === "video") return <div className="absolute inset-0 flex items-center justify-center bg-ink pt-8 text-2xl text-white/80" aria-hidden>▶</div>;
  return <div className="absolute inset-0 bg-gradient-to-br from-paper to-rule" aria-hidden />;
}

// The Moments card on /journals, laid out like the Status row in WhatsApp: your own tile first (your picture, with a + to add one), then a
// tile for each member you follow who has a moment up. Tap a tile to watch. Moments show only to people the owner allows (their followers,
// or everyone if they chose that in their profile settings). Live videos will join this row when live video is switched on.
export default function MomentsStrip() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [data, setData] = useState<{ groups: MomentGroup[]; me: Me } | null>(null);
  const [viewing, setViewing] = useState<MomentGroup | null>(null);
  const [composing, setComposing] = useState(false);
  useEffect(() => (MOMENTS_LIVE ? onAuthStateChanged(auth, setUser) : undefined), []);
  const load = useCallback(() => {
    if (!user) return;
    api<{ groups: MomentGroup[]; me: Me }>("/api/moments").then(setData).catch(() => setData(null));
  }, [user]);
  useEffect(() => { load(); }, [load]);

  if (!MOMENTS_LIVE || !user || !data) return null;
  const mine = data.groups.find((g) => g.ownerUid === data.me.uid);
  const others = data.groups.filter((g) => g.ownerUid !== data.me.uid);
  const tile = "relative h-40 w-28 shrink-0 overflow-hidden rounded-2xl border border-rule text-left";

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" aria-label="Moments">
      <div className="card p-5">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Moments</p>
          <p className="text-xs text-slate">From you and the people you follow</p>
        </div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {/* Your own tile */}
          <div className="relative shrink-0">
            <button type="button" onClick={() => (mine ? setViewing(mine) : setComposing(true))} className={tile} aria-label={mine ? "View your moments" : "Add a moment"}>
              <Preview group={mine} />
              <span className="absolute left-2 top-2 block rounded-2xl bg-white p-[2px] shadow">
                <Avatar src={data.me.avatar} alt="" size={40} square />
              </span>
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-xs font-bold text-white">My moments</span>
            </button>
            <button type="button" onClick={() => setComposing(true)} aria-label="Add a moment" className="absolute left-[34px] top-[34px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-crimson text-base font-bold leading-none text-white shadow">+</button>
          </div>
          {others.map((g) => (
            <button key={g.ownerUid} type="button" onClick={() => setViewing(g)} className={tile} aria-label={`View ${g.displayName}'s moments`}>
              <Preview group={g} />
              <span className="absolute left-2 top-2 block rounded-2xl bg-gradient-to-tr from-crimson via-crimson-bright to-amber-400 p-[3px] shadow">
                <span className="block rounded-2xl bg-white p-[2px]"><Avatar src={g.avatar} alt="" size={36} square /></span>
              </span>
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-xs font-bold text-white">{g.displayName}</span>
            </button>
          ))}
          {!others.length && <p className="self-center pl-2 text-sm text-slate">When people you follow share a moment, it shows up here.</p>}
        </div>
      </div>
      {viewing && <MomentViewer moments={viewing.moments} onClose={() => { setViewing(null); load(); }} onChanged={load} />}
      {composing && <MomentComposer onClose={() => setComposing(false)} onPosted={load} />}
    </section>
  );
}
