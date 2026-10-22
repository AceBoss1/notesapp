"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LIFE_LIVE } from "@/lib/life/catalog";
import { cardTurn, hideCard, type CardState } from "@/lib/life/social";
import type { FeedCard } from "@/lib/life/social-server";

// "Need a 5-minute break?": Notes Life in the journal feed, like LinkedIn's daily puzzle. Between posts on a phone, in the right
// column on a computer. At most twice a day (one page view counts once, whichever of the two places shows it); ✕ hides it for a week.
// Not in teen mode, and not if the member switched "Notes Life card in my feed" off.
const KEY = "notes-life-card";
let turn: boolean | null = null; // decided once per page load, shared by both places
function takeTurn(): boolean {
  if (turn !== null) return turn;
  try {
    const now = new Date().toISOString();
    const r = cardTurn(JSON.parse(localStorage.getItem(KEY) || "null") as CardState | null, now);
    localStorage.setItem(KEY, JSON.stringify(r.next));
    turn = r.show;
  } catch { turn = false; }
  return turn;
}

export default function LifeFeedCard({ place }: { place: "between" | "aside" }) {
  const [card, setCard] = useState<FeedCard | null>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!LIFE_LIVE) return;
    return onAuthStateChanged(auth, async (u) => {
      if (!takeTurn()) return;
      const token = await u?.getIdToken().catch(() => undefined);
      fetch("/api/life/social?feed=1", { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((r) => (r.ok ? r.json() : null)).then((c: FeedCard | null) => setCard(c?.show ? c : null)).catch(() => undefined);
    });
  }, []);
  if (!card || gone) return null;
  const close = () => { try { localStorage.setItem(KEY, JSON.stringify(hideCard(JSON.parse(localStorage.getItem(KEY) || "null"), new Date().toISOString()))); } catch { /* fine */ } setGone(true); };
  const f = card.friends;
  const friendsLine = f.count ? `${f.sample[0]?.name.split(" ")[0]}${f.count > 1 ? ` and ${f.count - 1} ${f.count - 1 === 1 ? "other person" : "other people"} you follow` : ""} ${f.count > 1 ? "play" : "plays"}` : "";
  const href = card.playing ? "/life/play" : "/life";
  const shell = place === "aside" ? "card p-5" : "border-b-[10px] border-[#F3ECE7] bg-card px-4 py-5 lg:hidden";
  return (
    <div className={shell}>
      <div className="flex items-center gap-2">
        <p className="font-ui text-[15px] font-bold text-ink">{card.playing ? "Notes Life 🎮" : "Need a 5-minute break? 🎮"}</p>
        <button onClick={close} aria-label="Hide for a week" className="ml-auto text-lg leading-none text-slate hover:text-ink">✕</button>
      </div>
      <div className={place === "aside" ? "mt-3" : "mt-3 flex items-center gap-3"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/life/game-room.webp" alt="" className={place === "aside" ? "h-24 w-full rounded-xl object-cover" : "h-20 w-20 shrink-0 rounded-xl object-cover"} />
        <div className={place === "aside" ? "mt-3" : "min-w-0 flex-1"}>
          <p className="font-ui text-sm font-bold text-ink">{card.playing ? "Your room in Wuse is waiting" : "Notes Life"}</p>
          <p className="mt-0.5 text-[13px] text-slate">{card.playing ? "Pick up where you left off: your needs, your shift, your money." : "Start in a room in Wuse with N$ 100,000. Hustle, build, ball out. Free, with your NotesApp account."}</p>
          {place !== "aside" && <a href={href} className="btn-primary mt-2 !px-4 !py-1.5 text-xs">{card.playing ? "Continue" : "Play free"}</a>}
        </div>
      </div>
      {friendsLine && (
        <div className="mt-3 flex items-center gap-2">
          <span className="flex -space-x-2">{f.sample.map((p, i) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={i} src={p.avatar || "/images/headshots/default-avatar.png"} alt="" className="h-6 w-6 rounded-full object-cover ring-2 ring-card" />)}</span>
          <span className="text-xs text-slate">{friendsLine}</span>
        </div>
      )}
      {place === "aside" && <a href={href} className="btn-primary mt-4 flex w-full !py-2 text-sm">{card.playing ? "Continue" : "Play free"}</a>}
    </div>
  );
}
