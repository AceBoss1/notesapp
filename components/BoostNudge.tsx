"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Shown only to the author, on their own post, when it has no active boost: a dismissible sheet with
// a small animated preview (hearts popping, counters racing up) inviting them to boost it. The
// numbers in the preview are an illustration of how a boosted post can look, not a promise or a
// measurement, and the sheet says so. Once per post per browser session; after "Maybe later" it
// stays away from that post for DISMISS_DAYS. Respects reduced-motion (counters just show the
// end values, no popping hearts).
const DISMISS_DAYS = 3;
const DELAY_MS = 3500;
const COUNT_MS = 3200;

const read = (store: "local" | "session", key: string) => {
  try {
    return (store === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
};
const write = (store: "local" | "session", key: string, value: string) => {
  try {
    (store === "local" ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    /* private mode — the sheet may simply show again */
  }
};

const fmt = (n: number) => n.toLocaleString("en-NG");

type Props = { noteId: string; title: string; author: string; authorAvatar?: string; authorUid?: string; views?: number; likes?: number; shares?: number };

export default function BoostNudge({ noteId, title, author, authorAvatar, authorUid, views = 0, likes = 0, shares = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState(0); // 0 → 1 animation progress
  const [hearts, setHearts] = useState<number[]>([]);
  const heartId = useRef(0);

  useEffect(() => {
    if (!authorUid) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (timer) clearTimeout(timer);
      if (!u || u.uid !== authorUid) return setOpen(false);
      if (read("session", `na_boost_nudge_${noteId}`) || Date.now() - Number(read("local", `na_boost_nudge_${noteId}`) || 0) < DISMISS_DAYS * 86_400_000) return;
      try {
        const snap = await getDocs(query(collection(db, "boosts"), where("publisherUid", "==", u.uid)));
        const now = Date.now();
        const boosted = snap.docs.some((d) => {
          const b = d.data() as { noteId?: string; status?: string; endsAt?: string };
          return b.noteId === noteId && b.status === "active" && new Date(b.endsAt || 0).getTime() > now;
        });
        if (boosted || !alive) return;
      } catch {
        return; // can't tell whether it's boosted — better to stay quiet than nag
      }
      timer = setTimeout(() => {
        write("session", `na_boost_nudge_${noteId}`, "1");
        if (alive) setOpen(true);
      }, DELAY_MS);
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [authorUid, noteId]);

  // Drive the counters and hearts while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setT(1);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_MS);
      setT(1 - Math.pow(1 - p, 3)); // fast at first, easing out
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const pop = setInterval(() => {
      const id = ++heartId.current;
      setHearts((h) => [...h.slice(-8), id]);
      setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1400);
    }, 260);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(pop);
    };
  }, [open]);

  if (!open) return null;

  function later() {
    write("local", `na_boost_nudge_${noteId}`, String(Date.now()));
    setOpen(false);
  }

  // Illustrative end values: a boosted post's counters climbing from where this post is now.
  const shown = (base: number, gain: number) => fmt(Math.round(base + gain * t));

  return (
    <div role="dialog" aria-label="Boost this post" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onClick={later}>
      <style>{`
        @keyframes na-heart-pop { 0% { transform: translateY(0) scale(.4); opacity: 0 } 15% { opacity: 1 } 100% { transform: translateY(-64px) scale(1.15); opacity: 0 } }
        @keyframes na-sheet-in { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .na-heart { display: none } .na-sheet { animation: none !important } }
      `}</style>
      <div
        className="na-sheet w-full max-w-md rounded-t-3xl bg-paper p-6 shadow-xl sm:rounded-3xl"
        style={{ animation: "na-sheet-in .35s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto max-w-sm rounded-2xl border border-rule bg-card p-4">
          <div className="flex items-center gap-2">
            {authorAvatar ? <img src={authorAvatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="h-8 w-8 rounded-full bg-rule" />}
            <p className="truncate font-ui text-sm font-bold text-ink">{author}</p>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-ink">{title}</p>
          <p className="mt-2 text-xs font-semibold text-slate">↗ Boosted</p>
          <div className="relative mt-2 flex items-center gap-4 text-xs text-slate">
            <span>💬 {shown(0, 3)}</span>
            <span>🔁 {shown(shares, 41)}</span>
            <span className="font-semibold text-pink-600">❤ {shown(likes, 1014)}</span>
            <span>📊 {shown(views, 18100)}</span>
            <div className="pointer-events-none absolute left-[42%] top-0" aria-hidden="true">
              {hearts.map((id) => (
                <span key={id} className="na-heart absolute text-base" style={{ left: `${(id * 37) % 40}px`, animation: "na-heart-pop 1.4s ease-out forwards" }}>
                  ❤️
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="mx-auto mt-1 max-w-sm text-center text-[10px] text-slate">Illustration of how a boosted post can look. Results vary and aren't guaranteed.</p>

        <h2 className="mt-4 font-display text-2xl leading-tight text-ink">Boost your post now for more visibility?</h2>
        <p className="mt-2 text-sm text-slate">Put this post in front of more readers across #NotesApp — on the home strip, trending and journals.</p>
        <Link href={`/boost/${noteId}`} onClick={() => write("local", `na_boost_nudge_${noteId}`, String(Date.now()))} className="btn-primary mt-5 block w-full text-center">
          Boost now
        </Link>
        <button onClick={later} className="mt-3 w-full rounded-full border border-rule py-3 text-sm font-semibold text-ink hover:border-crimson">
          Maybe later
        </button>
      </div>
    </div>
  );
}
