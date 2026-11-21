"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { capi } from "@/components/community/api";
import { RoomScreen, type FeedPreview } from "@/components/community/AudioRoom";
import type { LiveCard } from "@/lib/profile-lives-server";
import GuestLive from "./GuestLive";
import LivePlayer, { FeedGate, useSignedIn } from "./LivePlayer";
import { Summary } from "./ProfileLive";
import { useGoLive } from "./useGoLive";

// Notes Live (/lives, and /live/<id> starting at that live): a full-screen vertical feed of the lives on now, one per screen, swiped
// like TikTok LIVE (owner, 21 Nov 2026). Built on the old live, the 🔴 Go live room from a profile (docs/GO_LIVE.md): the lives are
// GET /api/lives?live_now=1 (public profile lives; hosts kept off lists, as in teen mode, are left out by the server), and the live in
// view is the room itself: RoomScreen (skin "feed") for members, GuestLive (feed) for people without an account where the host allows
// it (docs/GUEST_LIVES.md). Only the live in view is joined, so only it plays sound; scrolling past it leaves the room.

type Slide = { id: string; card?: LiveCard };
type Upcoming = { id: string; title: string; poster: string; hostName: string; hostUsername: string; startsAt: string; status: string };
const ACTIVATE_MS = 350; // a live has to stay in view this long before it's joined, so a fast swipe doesn't join every live it passes
const lagos = (iso: string) => new Date(iso).toLocaleString("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const previewOf = (c: LiveCard): FeedPreview => ({ hostName: c.hostName, hostUsername: c.hostUsername, hostAvatar: c.hostAvatar, poster: c.poster, watching: c.watching });

export default function LiveFeed({ startId }: { startId?: string }) {
  const user = useSignedIn();
  const router = useRouter();
  const goLive = useGoLive();
  const [lives, setLives] = useState<LiveCard[] | null>(null);
  const [visible, setVisible] = useState(0);
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  // The lives on now, every 30 seconds. Lives already in the feed keep their place (so nothing jumps under your thumb); new ones join
  // at the end, and one that has ended stays until you scroll to it, where it says so.
  useEffect(() => {
    let dead = false;
    const load = () => capi<{ lives: LiveCard[] }>("/api/lives?live_now=1").then((r) => {
      if (dead) return;
      setLives((prev) => {
        if (!prev) return r.lives;
        const fresh = new Map(r.lives.map((l) => [l.id, l]));
        return [...prev.map((l) => fresh.get(l.id) ?? l), ...r.lives.filter((l) => !prev.some((p) => p.id === l.id))];
      });
    }).catch(() => { if (!dead) setLives((p) => p ?? []); });
    void load();
    const t = window.setInterval(load, 30_000);
    return () => { dead = true; window.clearInterval(t); };
  }, []);

  // Back from joining or signing in while watching as a guest (docs/GUEST_LIVES.md): counted once for the host, then in.
  useEffect(() => {
    if (!user || !startId || new URLSearchParams(window.location.search).get("from") !== "guest") return;
    window.history.replaceState(null, "", `/live/${startId}`);
    void capi("/api/lives/watch", { action: "converted", id: startId }).catch(() => {});
  }, [user, startId]);

  // Nothing is drawn until Live now has answered, so a /live/<id> that turns out to be on now isn't joined twice (once from its lobby).
  const slides: Slide[] = lives === null ? []
    : startId ? [{ id: startId, card: lives.find((l) => l.id === startId) }, ...lives.filter((l) => l.id !== startId).map((l) => ({ id: l.id, card: l }))]
    : lives.map((l) => ({ id: l.id, card: l }));
  const count = slides.length;

  // Which live is in view: the slide most on screen. It becomes the live that plays once it has settled.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.6) setVisible(Number((e.target as HTMLElement).dataset.index));
    }, { root, threshold: [0.6] });
    root.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [count]);
  useEffect(() => {
    const t = window.setTimeout(() => setActive(visible), ACTIVATE_MS);
    return () => window.clearTimeout(t);
  }, [visible]);

  const go = useCallback((i: number) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-index="${i}"]`);
    el?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
  }, []);
  const close = useCallback(() => {
    const sameSite = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin);
    if (sameSite && window.history.length > 1) router.back(); else router.push("/");
  }, [router]);

  // Arrow keys, Page Up/Down and J/K move through the feed; Escape closes it. Not while typing a comment.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (document.querySelector("[aria-modal='true']") && e.key !== "Escape") return;
      if (["ArrowDown", "PageDown", "j"].includes(e.key)) { e.preventDefault(); go(Math.min(visible + 1, count)); }
      else if (["ArrowUp", "PageUp", "k"].includes(e.key)) { e.preventDefault(); go(Math.max(visible - 1, 0)); }
      else if (e.key === "Escape" && !document.querySelector("[aria-modal='true']")) close();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [visible, count, go, close]);

  // Full screen: the page behind doesn't scroll.
  useEffect(() => {
    const html = document.documentElement, prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { html.style.overflow = prev; };
  }, []);

  const loading = lives === null;
  return (
    <div className="fixed inset-0 z-[80] bg-black text-white" aria-label="Notes Live" role="region" data-live-feed>
      <div ref={scroller} className="h-full w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading && <div className="flex h-[100dvh] items-center justify-center text-sm text-white/60" role="status">Finding who&apos;s live…</div>}
        {slides.map((s, i) => (
          <section key={s.id} data-index={i} aria-label={s.card ? `${s.card.hostName}: ${s.card.title}` : "Live"} className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center lg:py-4">
            <div className="relative h-full w-full lg:aspect-[9/16] lg:w-auto">
              <FeedSlide slide={s} active={i === active && i === visible} near={Math.abs(i - visible) <= 1} user={user} onClose={close} onNext={() => go(i + 1)} />
            </div>
          </section>
        ))}
        {!loading && (
          <section data-index={count} aria-label={count ? "You're all caught up" : "Nobody is live"} className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center lg:py-4">
            <div className="relative h-full w-full lg:aspect-[9/16] lg:w-auto">
              <CaughtUp empty={!count} goLive={!!goLive} onClose={close} />
            </div>
          </section>
        )}
      </div>

      {/* On a computer: the name and the ways out on the left, close on the right, and up/down beside the column. */}
      <nav className="pointer-events-none absolute left-6 top-5 hidden flex-col gap-3 lg:flex" aria-label="Notes Live">
        <p className="font-display text-2xl">Notes <span style={{ color: "#FE2C55" }}>Live</span></p>
        <span className="pointer-events-auto flex flex-col items-start gap-1.5 font-ui text-sm">
          <span className="rounded-full bg-white/15 px-3 py-1.5 font-bold" aria-current="page">● Live now{lives?.length ? ` · ${lives.length}` : ""}</span>
          <Link href="/lives/paid" className="rounded-full px-3 py-1.5 text-white/75 hover:bg-white/10 hover:text-white">🎟 Paid lives</Link>
          {goLive && <Link href="/lives/start" className="rounded-full px-3 py-1.5 font-bold text-white hover:bg-white/10" style={{ background: "#FE2C55" }}>🔴 Go live</Link>}
        </span>
        <p className="mt-2 max-w-[13rem] text-xs text-white/45">↑ ↓ or the wheel to move between lives · double-tap to send hearts · Esc to close</p>
      </nav>
      <button type="button" onClick={close} aria-label="Close Notes Live" className="absolute right-5 top-5 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-3xl leading-none hover:bg-white/20 lg:flex">×</button>
      <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
        <button type="button" onClick={() => go(Math.max(visible - 1, 0))} disabled={visible === 0} aria-label="Previous live" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20 disabled:opacity-30">▲</button>
        <button type="button" onClick={() => go(Math.min(visible + 1, count))} disabled={visible >= count} aria-label="Next live" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20 disabled:opacity-30">▼</button>
      </div>
    </div>
  );
}

// One live in the feed. Out of view: its card (the picture, the host, the count). In view: the room.
function FeedSlide({ slide, active, near, user, onClose, onNext }: { slide: Slide; active: boolean; near: boolean; user: ReturnType<typeof useSignedIn>; onClose: () => void; onNext: () => void }) {
  const { id, card } = slide;
  const [ended, setEnded] = useState<string | null>(null);
  const [openOwn, setOpenOwn] = useState(false);
  const activeRef = useRef(active); activeRef.current = active;
  useEffect(() => { if (!active) setOpenOwn(false); }, [active]);
  const idle = (
    <LivePlayer idle title={card?.title ?? ""} host={{ name: card?.hostName ?? "", username: card?.hostUsername ?? "", avatar: near ? card?.hostAvatar ?? "" : "" }}
      watching={card?.watching ?? 0} likes={0} poster={near ? card?.poster : ""} onClose={onClose} status={active && user === undefined ? "Loading…" : undefined} />
  );
  if (ended) {
    return (
      <FeedGate poster={card?.poster || card?.hostAvatar} ended eyebrow={card ? `@${card.hostUsername}` : ""} heading={card?.title} title={ended} onClose={onClose}>
        <div className="mt-5 flex flex-col items-center gap-2">
          <button type="button" onClick={onNext} className="rounded-full bg-white px-5 py-2.5 font-ui text-sm font-bold text-ink">Next live ↓</button>
          {/left/i.test(ended) && <button type="button" onClick={() => setEnded(null)} className="text-sm text-white/80 underline">Join again</button>}
          {card && <Link href={`/u/${card.hostUsername}`} className="text-sm text-white/80 underline">See @{card.hostUsername}&apos;s profile</Link>}
        </div>
      </FeedGate>
    );
  }
  if (!active || user === undefined) return idle;
  if (user === null) return <GuestLive id={id} feed={{ onClose }} />;
  // Why the room closed: "" when you left it yourself (Leave quietly), otherwise the room's reason. Ignored once scrolled away (leaving
  // a live by scrolling past it isn't news).
  const done = (message?: string) => {
    if (!activeRef.current) return;
    setEnded(!message || /left the room/i.test(message) ? "You left the live." : /has ended/i.test(message) ? "This live has ended." : message);
  };
  if (!card) return <StartSlide id={id} me={user.uid} onClose={onClose} onDone={done} />;
  // Your own live: never joined by scrolling past it (you'd be back on stage as the host); one tap opens it.
  if (card.hostUid === user.uid && !openOwn) {
    return (
      <FeedGate poster={card.poster || card.hostAvatar} eyebrow="Your live" heading={card.title} title={`${card.watching.toLocaleString("en-GB")} watching`} onClose={onClose}>
        <button type="button" onClick={() => setOpenOwn(true)} className="mt-5 rounded-full bg-white px-5 py-2.5 font-ui text-sm font-bold text-ink">Back to your live</button>
      </FeedGate>
    );
  }
  return <RoomScreen key={id} id={id} me={user.uid} title={card.title} skin="feed" preview={previewOf(card)} onClose={onClose} onDone={done} />;
}

// /live/<id> for a live that isn't in Live now (followers or subscribers only, ended, or just started): its lobby decides.
function StartSlide({ id, me, onClose, onDone }: { id: string; me: string; onClose: () => void; onDone: (message?: string) => void }) {
  const [d, setD] = useState<{ live: LiveCard; status: "live" | "ended"; canJoin: boolean; host: boolean } | null>(null);
  const [err, setErr] = useState("");
  const [openOwn, setOpenOwn] = useState(false);
  useEffect(() => { capi<NonNullable<typeof d>>(`/api/lives?live=${encodeURIComponent(id)}`).then(setD).catch((e) => setErr(e instanceof Error ? e.message : "That live wasn't found.")); }, [id]);
  if (err) return <FeedGate title={err} onClose={onClose}><Link href="/lives" className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 font-ui text-sm font-bold text-ink">See who&apos;s live</Link></FeedGate>;
  if (!d) return <LivePlayer idle title="" host={{ name: "", username: "", avatar: "" }} watching={0} likes={0} status="Loading…" onClose={onClose} />;
  const l = d.live;
  if (d.host && d.status === "ended") return <div className="h-full overflow-y-auto bg-paper px-4 pb-10 pt-4 text-ink lg:rounded-2xl"><Summary id={id} /></div>;
  if (d.status === "ended") {
    return (
      <FeedGate poster={l.poster || l.hostAvatar} ended eyebrow={`@${l.hostUsername}`} heading={l.title} title="This live has ended" body={`See @${l.hostUsername}'s replays and what's next on their profile.`} onClose={onClose}>
        <Link href={`/u/${l.hostUsername}`} className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 font-ui text-sm font-bold text-ink">See @{l.hostUsername}&apos;s profile</Link>
      </FeedGate>
    );
  }
  if (!d.canJoin) {
    return (
      <FeedGate poster={l.poster || l.hostAvatar} eyebrow={`@${l.hostUsername} · ${l.watching.toLocaleString("en-GB")} watching`} heading={l.title} title={`For @${l.hostUsername}'s ${l.audience}`} body={`${l.audience === "subscribers" ? "Subscribe" : "Follow"} on their profile to join.`} onClose={onClose}>
        <Link href={`/u/${l.hostUsername}`} className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 font-ui text-sm font-bold text-ink">{l.audience === "subscribers" ? "Subscribe" : "Follow"} @{l.hostUsername}</Link>
      </FeedGate>
    );
  }
  if (d.host && !openOwn) {
    return (
      <FeedGate poster={l.poster || l.hostAvatar} eyebrow="Your live" heading={l.title} title={`${l.watching.toLocaleString("en-GB")} watching`} onClose={onClose}>
        <button type="button" onClick={() => setOpenOwn(true)} className="mt-5 rounded-full bg-white px-5 py-2.5 font-ui text-sm font-bold text-ink">Back to your live</button>
      </FeedGate>
    );
  }
  return <RoomScreen id={id} me={me} title={l.title} skin="feed" preview={previewOf(l)} onClose={onClose} onDone={onDone} />;
}

// The end of the feed, and the whole feed when nobody is live: paid lives coming up, and Go live for those who may.
function CaughtUp({ empty, goLive, onClose }: { empty: boolean; goLive: boolean; onClose: () => void }) {
  const [up, setUp] = useState<Upcoming[] | null>(null);
  useEffect(() => { capi<{ upcoming: Upcoming[] }>("/api/lives").then((r) => setUp(r.upcoming.slice(0, 6))).catch(() => setUp([])); }, []);
  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto bg-gradient-to-b from-[#2a0812] via-[#120709] to-black px-5 pb-[calc(env(safe-area-inset-bottom)_+_1.5rem)] pt-[calc(env(safe-area-inset-top)_+_1rem)] lg:rounded-2xl" data-live-empty={empty ? "" : undefined}>
      <div className="flex items-center justify-between">
        <p className="font-display text-xl">Notes <span style={{ color: "#FE2C55" }}>Live</span></p>
        <button type="button" onClick={onClose} aria-label="Close Notes Live" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-2xl leading-none lg:hidden">×</button>
      </div>
      <div className="mt-[12vh] text-center">
        <p className="text-5xl" aria-hidden>{empty ? "📡" : "✨"}</p>
        <h2 className="mt-3 font-display text-3xl leading-tight">{empty ? "Nobody is live right now" : "You're all caught up"}</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-white/65">{empty ? "When someone goes live, they show up here. Swipe through them like a feed." : "That's everyone live right now. New lives join the feed as they start."}</p>
        {goLive && <Link href="/lives/start" className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 font-ui text-sm font-bold text-white shadow-lg" style={{ background: "#FE2C55" }}>🔴 Go live</Link>}
      </div>
      <section className="mt-10" aria-labelledby="coming-up">
        <div className="flex items-baseline justify-between">
          <h3 id="coming-up" className="font-ui text-xs font-bold uppercase tracking-[0.2em] text-white/55">Coming up · paid lives</h3>
          <Link href="/lives/paid" className="text-xs font-semibold text-white/75 underline">All paid lives</Link>
        </div>
        {up === null ? <p className="mt-3 text-sm text-white/50">Loading…</p> : up.length ? (
          <ul className="mt-3 space-y-2">
            {up.map((c) => (
              <li key={c.id}>
                <Link href={`/lives/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5 hover:bg-white/[0.1]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.poster ? <img src={c.poster} alt="" className="h-14 w-11 shrink-0 rounded-lg object-cover" /> : <span className="flex h-14 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg" aria-hidden>🎟</span>}
                  <span className="min-w-0 flex-1">
                    <b className="block truncate font-ui text-sm">{c.title}</b>
                    <span className="block truncate text-xs text-white/60">{c.status === "live" ? <span style={{ color: "#FF6B8B" }}>● Live now</span> : `${lagos(c.startsAt)} (Lagos)`} · {c.hostName || `@${c.hostUsername}`}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-white/50">No paid lives scheduled right now.</p>}
      </section>
    </div>
  );
}
