"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { followJournal, isFollowing } from "@/lib/follows";
import { isAutoFollowed } from "@/lib/journals-directory";
import { useGoLive } from "./useGoLive";

// Notes Live, TikTok style (owner, 21 Nov 2026: "I need it to look like tiktok using old live"): the full-screen player one live fills.
// Only the look lives here. The room itself (joining, the relay, the chat, likes, gifts) is the old live's: components/community/
// AudioRoom.tsx RoomScreen draws this for viewers when it runs inside the feed (skin "feed"), and components/lives/GuestLive.tsx draws it
// for people watching without an account. The feed that swipes between lives is components/lives/LiveFeed.tsx.

export type PlayerLine = { id: string; name: string; text: string; ev?: string };
export type PlayerPerson = { key: string; name: string; avatar: string; badge?: string };
export type PlayerMore = { label: string; onClick?: () => void; href?: string; pressed?: boolean };
export type PlayerComment =
  | { kind: "input"; send: (text: string) => Promise<boolean>; maxLength: number; note?: string }
  | { kind: "prompt"; label: string; onClick: () => void };

const LIVE_RED = "#FE2C55";
const fmt = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K` : n.toLocaleString("en-GB"));

export function useSignedIn(): User | null | undefined {
  const [u, setU] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setU), []);
  return u;
}

// Follow (+) beside the host's name: gone once you follow. Signed out, it asks to join (onGuest).
export function FollowPlus({ username, onFollow, onGuest }: { username: string; onFollow?: () => void; onGuest?: () => void }) {
  const user = useSignedIn();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user || !username) { setFollowing(null); return; }
    if (isAutoFollowed(username)) { setFollowing(true); return; }
    isFollowing(user.uid, username).then(setFollowing).catch(() => setFollowing(false));
  }, [user, username]);
  if (!username || user === undefined || following === true || (user && following === null)) return null;
  const go = async () => {
    if (!user) { onGuest?.(); return; }
    setBusy(true);
    try { await followJournal(user.uid, username, false); setFollowing(true); onFollow?.(); } catch { /* the button stays */ } finally { setBusy(false); }
  };
  return (
    <button type="button" onClick={() => void go()} disabled={busy} aria-label={`Follow @${username}`}
      className="ml-1 flex h-7 shrink-0 items-center gap-0.5 rounded-full px-2.5 font-ui text-xs font-bold text-white disabled:opacity-60" style={{ background: LIVE_RED }}>
      <span aria-hidden className="text-sm leading-none">+</span>Follow
    </button>
  );
}

function VideoEl({ stream, className = "", mirror }: { stream: MediaStream; className?: string; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={`${className} ${mirror ? "-scale-x-100" : ""}`} />;
}

// The sound of the stage. A browser may refuse to start sound before the viewer has tapped the page: then "Tap for sound" shows.
function Sounds({ sounds, onBlocked }: { sounds: { key: string; stream: MediaStream; muted?: boolean }[]; onBlocked: (b: boolean) => void }) {
  return <>{sounds.map((s) => <SoundEl key={s.key} stream={s.stream} muted={!!s.muted} onBlocked={onBlocked} />)}</>;
}
function SoundEl({ stream, muted, onBlocked }: { stream: MediaStream; muted: boolean; onBlocked: (b: boolean) => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().then(() => onBlocked(false)).catch(() => onBlocked(true));
  }, [stream, onBlocked]);
  return <audio ref={ref} autoPlay muted={muted} className="hidden" data-live-sound />;
}

type Heart = { id: number; x: number; y: number; hue: string; drift: number };
const HEART_HUES = ["#FE2C55", "#FF6B8B", "#FFB4C6", "#FF8A3D", "#E8B23A", "#C86BFF"];

export default function LivePlayer({
  title, host, ended, watching, likes, video, mirror, poster, extraVideos = [], screen, sounds = [], lines = [], pinned, follow, faces = [],
  loadViewers, onClose, liked, onLike, onGift, onShare, more = [], comment, status, idle, notice, children,
}: {
  title: string;
  host: { name: string; username: string; avatar: string };
  ended?: boolean;
  watching: number; likes: number;
  video?: MediaStream | null; mirror?: boolean; poster?: string;
  extraVideos?: { key: string; stream: MediaStream; label: string }[];
  screen?: ReactNode; // in place of the video (the studio's programme)
  sounds?: { key: string; stream: MediaStream; muted?: boolean }[];
  lines?: PlayerLine[]; pinned?: string;
  follow?: ReactNode;
  faces?: PlayerPerson[];
  loadViewers?: () => Promise<PlayerPerson[]>;
  onClose?: () => void;
  liked?: boolean; onLike?: () => void;
  onGift?: () => void; onShare?: () => void;
  more?: PlayerMore[];
  comment?: PlayerComment;
  status?: string;
  idle?: boolean; // a live scrolled past or not yet in view: the picture and the names, nothing that acts
  notice?: ReactNode; // a line under the header (guests: "watching as a guest")
  children?: ReactNode;
}) {
  const goLive = useGoLive(); // 🔴 Go live for whoever may start one today (lib/profile-lives-server.ts mayStartProfileLive)
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [viewers, setViewers] = useState<PlayerPerson[] | null>(null);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [text, setText] = useState("");
  const [sendErr, setSendErr] = useState("");
  const frame = useRef<HTMLDivElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);
  const heartId = useRef(0);

  const addHeart = (x?: number, y?: number) => {
    const box = frame.current?.getBoundingClientRect();
    const w = box?.width ?? 360, h = box?.height ?? 640;
    const id = ++heartId.current;
    const heart = { id, x: x ?? w - 44, y: y ?? h - 150, hue: HEART_HUES[id % HEART_HUES.length], drift: (Math.random() - 0.5) * 60 };
    setHearts((hs) => [...hs.slice(-24), heart]);
    setTimeout(() => setHearts((hs) => hs.filter((x2) => x2.id !== id)), 1700);
  };
  // Everyone's likes: a heart floats up for each new one (a few at most at once).
  const prevLikes = useRef(likes);
  useEffect(() => {
    const more2 = likes - prevLikes.current;
    prevLikes.current = likes;
    if (idle || more2 <= 0) return;
    for (let i = 0; i < Math.min(more2, 4); i++) setTimeout(() => addHeart(), i * 180);
  }, [likes, idle]); // eslint-disable-line react-hooks/exhaustive-deps

  const like = (x?: number, y?: number) => { addHeart(x, y); onLike?.(); };
  // Double-tap the video: hearts where you tapped (TikTok's gesture). A single tap does nothing, so nothing starts by accident.
  const onTap = (e: React.PointerEvent) => {
    if (idle) return;
    const now = Date.now();
    const box = frame.current?.getBoundingClientRect();
    if (now - lastTap.current < 320 && box) { like(e.clientX - box.left, e.clientY - box.top); lastTap.current = 0; }
    else lastTap.current = now;
  };

  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "end" }); }, [lines.length]);

  const openViewers = async () => {
    setViewersOpen(true);
    if (loadViewers) setViewers(await loadViewers().catch(() => []));
  };
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (comment?.kind !== "input") return;
    const t = text.trim();
    if (!t) return;
    setText(""); setSendErr("");
    const ok = await comment.send(t.slice(0, comment.maxLength));
    if (!ok) { setText(t); setSendErr("Couldn't send. Try again."); setTimeout(() => setSendErr(""), 3000); }
  };

  const shown = lines.slice(-40);
  const pic = poster || host.avatar;
  const icon = "flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-[22px] text-white backdrop-blur-sm transition hover:bg-black/55 lg:bg-white/10 lg:hover:bg-white/20";
  const label = "mt-1 font-ui text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]";

  return (
    <div ref={frame} className="relative h-full w-full text-white" data-live-player>
      <style>{`
.lp-heart{position:absolute;pointer-events:none;font-size:30px;animation:lp-up 1.6s ease-out forwards;will-change:transform,opacity}
@keyframes lp-up{0%{transform:translate(-50%,-50%) scale(.4);opacity:0}12%{transform:translate(-50%,-60%) scale(1.15);opacity:1}100%{transform:translate(calc(-50% + var(--drift)),-260px) scale(.9);opacity:0}}
.lp-pulse{animation:lp-pulse 1.8s ease-in-out infinite}
@keyframes lp-pulse{0%,100%{box-shadow:0 0 0 0 rgba(254,44,85,.55)}50%{box-shadow:0 0 0 18px rgba(254,44,85,0)}}
.lp-chat{-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 34%);mask-image:linear-gradient(to bottom,transparent 0,#000 34%)}
.lp-line{animation:lp-in .25s ease-out}
@keyframes lp-in{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.lp-heart{animation:lp-fade 1s ease-out forwards}@keyframes lp-fade{from{opacity:1}to{opacity:0}}.lp-pulse,.lp-line{animation:none}}
`}</style>

      {/* The picture: the camera, the studio's programme, or (an audio live, or before video is up) the poster. */}
      <div className="absolute inset-0 overflow-hidden bg-black lg:rounded-2xl" onPointerUp={onTap}>
        {screen ? <div className="absolute inset-0 flex items-center justify-center">{screen}</div>
          : video ? <VideoEl stream={video} mirror={mirror} className="absolute inset-0 h-full w-full object-cover" />
          : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {pic ? <img src={pic} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" /> : <div className="absolute inset-0 bg-gradient-to-b from-[#3a0a18] to-black" />}
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt={`${host.name}'s poster`} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-x-0 top-[20%] flex flex-col items-center gap-4">
                  <span className={`rounded-full p-1 ${ended || idle ? "" : "lp-pulse"}`} style={{ background: LIVE_RED }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {host.avatar ? <img src={host.avatar} alt="" className="h-28 w-28 rounded-full border-4 border-black object-cover" /> : <span className="block h-28 w-28 rounded-full border-4 border-black bg-white/10" />}
                  </span>
                  <span className="rounded-full bg-black/40 px-3 py-1 font-ui text-xs font-semibold text-white/85">🎙 {ended ? "This live has ended" : "Audio live"}</span>
                </div>
              )}
            </>
          )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      </div>

      {/* Top left: the host, LIVE and the count, Follow. Top right: who is watching, and close. */}
      <header className="absolute inset-x-0 top-0 flex items-start gap-2 px-3 pt-[calc(env(safe-area-inset-top)_+_0.75rem)]">
        <div className="flex min-w-0 items-center gap-2 rounded-full bg-black/35 py-1 pl-1 pr-1.5 backdrop-blur-sm">
          <Link href={host.username ? `/u/${host.username}` : "#"} className="shrink-0" aria-label={`${host.name}'s profile`} tabIndex={idle ? -1 : 0}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {host.avatar ? <img src={host.avatar} alt="" className="h-9 w-9 rounded-full object-cover ring-2" style={{ ["--tw-ring-color" as string]: LIVE_RED }} /> : <span className="block h-9 w-9 rounded-full bg-white/20" />}
          </Link>
          <div className="min-w-0 leading-tight">
            <p className="max-w-[7.5rem] truncate font-ui text-[13px] font-bold sm:max-w-[12rem]">{host.name}</p>
            <p className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-white/85">
              <span className="rounded-[4px] px-1 py-px font-ui text-[10px] font-extrabold tracking-wide text-white" style={{ background: ended ? "#555" : LIVE_RED }}>{ended ? "ENDED" : "LIVE"}</span>
              <span aria-label={`${watching} watching`}>{fmt(watching)} watching</span>
            </p>
          </div>
          {!idle && follow}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {!idle && (
            <button type="button" onClick={() => void openViewers()} className="flex items-center rounded-full bg-black/35 py-1 pl-1 pr-2.5 backdrop-blur-sm" aria-label={`Viewers: ${watching} watching`}>
              <span className="flex -space-x-2">
                {faces.slice(0, 3).map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  f.avatar ? <img key={f.key} src={f.avatar} alt="" className="h-7 w-7 rounded-full border-2 border-black/60 object-cover" /> : <span key={f.key} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-black/60 bg-white/20 text-[10px] font-bold">{f.name.slice(0, 1)}</span>
                ))}
              </span>
              <span className="ml-1.5 font-ui text-xs font-bold">{fmt(watching)}</span>
            </button>
          )}
          {onClose && <button type="button" onClick={onClose} aria-label="Close Notes Live" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-2xl leading-none backdrop-blur-sm lg:hidden">×</button>}
        </div>
      </header>
      {notice && !idle && <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)_+_4.25rem)]">{notice}</div>}

      {/* Guests on stage with a camera: small tiles on the right, like a multi-guest live. */}
      {extraVideos.length > 0 && !idle && (
        <div className="absolute right-3 top-[calc(env(safe-area-inset-top)_+_4.5rem)] flex flex-col gap-2">
          {extraVideos.slice(0, 3).map((v) => (
            <div key={v.key} className="relative h-36 w-24 overflow-hidden rounded-xl bg-black ring-1 ring-white/20">
              <VideoEl stream={v.stream} className="h-full w-full object-cover" />
              <span className="absolute inset-x-1 bottom-1 truncate rounded bg-black/50 px-1 text-[10px]">{v.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Floating hearts. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden lg:rounded-2xl" aria-hidden>
        {hearts.map((h) => <span key={h.id} className="lp-heart" style={{ left: h.x, top: h.y, color: h.hue, ["--drift" as string]: `${h.drift}px` }}>♥</span>)}
      </div>

      {status && <p className="absolute left-1/2 top-[50%] max-w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black/60 px-4 py-2 text-center text-sm" role="status" aria-live="polite">{status}</p>}
      {blocked && !idle && (
        <button type="button" onClick={() => { document.querySelectorAll<HTMLAudioElement>("audio[data-live-sound]").forEach((a) => void a.play().catch(() => {})); setBlocked(false); }}
          className="absolute left-1/2 top-[38%] -translate-x-1/2 rounded-full bg-white px-5 py-2.5 font-ui text-sm font-bold text-ink shadow-lg">🔇 Tap for sound</button>
      )}

      {/* Bottom left: the title, the pinned line and the comments rising over the video, newest at the bottom. */}
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)_+_4.25rem)] left-3 right-[4.75rem] lg:right-3">
        {!idle && (
          <div className="lp-chat flex max-h-[34vh] flex-col overflow-y-auto overscroll-contain pt-10 [scrollbar-width:none]" aria-live="polite" aria-label="Comments">
            <ul className="flex flex-col items-start gap-1.5">
              {shown.map((m) => (
                <li key={m.id} className="lp-line max-w-full">
                  {m.ev ? (
                    <span className={`inline-block rounded-2xl px-2.5 py-1 text-[12.5px] leading-snug ${m.ev === "gift" ? "bg-[#E8B23A]/85 font-semibold text-ink" : "bg-black/25 text-white/80"}`} data-room-event={m.ev}>
                      {m.ev === "join" ? "👋 " : m.ev === "follow" ? "➕ " : m.ev === "share" ? "↗︎ " : m.ev === "like" ? "❤️ " : ""}{m.name ? `${m.name} ` : ""}{m.text}
                    </span>
                  ) : (
                    <span className="inline-block max-w-full break-words rounded-2xl bg-black/30 px-2.5 py-1 text-[13.5px] leading-snug">
                      <b className="mr-1 font-ui text-white/70">{m.name}</b>{m.text}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div ref={chatEnd} />
          </div>
        )}
        {pinned && !idle && <p className="mt-2 rounded-xl bg-black/45 px-2.5 py-1.5 text-[12.5px]">📌 {pinned}</p>}
        <h2 className="mt-2 line-clamp-2 font-ui text-[15px] font-bold leading-snug [text-shadow:0_1px_3px_rgba(0,0,0,.7)]">{title}</h2>
        <p className="font-ui text-xs text-white/75 [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">@{host.username || host.name}</p>
      </div>

      {/* Right: the action column (outside the video on a computer). */}
      {!idle && (
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom)_+_4.5rem)] right-2 flex flex-col items-center gap-3 lg:-right-[4.75rem] lg:bottom-2">
          {goLive && (
            <span className="flex flex-col items-center lg:hidden">
              <Link href="/lives/start" aria-label="Go live" className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-white shadow-md" style={{ background: LIVE_RED }}>🔴</Link>
              <span className={label}>Go live</span>
            </span>
          )}
          <span className="flex flex-col items-center">
            <button type="button" onClick={() => like()} aria-pressed={!!liked} aria-label={`Like the live${likes ? `, ${likes} likes` : ""}`} className={icon} style={liked ? { color: LIVE_RED } : undefined}>{liked ? "♥" : "♡"}</button>
            <span className={label}>{fmt(likes)}</span>
          </span>
          {onGift && (
            <span className="flex flex-col items-center">
              <button type="button" onClick={onGift} aria-label="Send a gift" className={icon}>🎁</button>
              <span className={label}>Gift</span>
            </span>
          )}
          {onShare && (
            <span className="flex flex-col items-center">
              <button type="button" onClick={onShare} aria-label="Share the live" className={icon}>↗︎</button>
              <span className={label}>Share</span>
            </span>
          )}
          {more.length > 0 && (
            <span className="flex flex-col items-center">
              <button type="button" onClick={() => setMoreOpen(true)} aria-label="More" aria-haspopup="dialog" className={icon}>⋯</button>
              <span className={label}>More</span>
            </span>
          )}
        </div>
      )}

      {/* Bottom: Add comment…, a gift and a heart. */}
      {!idle && comment && (
        <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)_+_0.75rem)] flex items-center gap-2">
          {comment.kind === "input" ? (
            <form onSubmit={send} className="flex min-w-0 flex-1 items-center rounded-full bg-white/15 pl-4 pr-1 backdrop-blur-md focus-within:bg-white/25">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={comment.maxLength} placeholder="Add comment…" aria-label="Add a comment"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-white/70 focus:outline-none" />
              {text.trim() && <button className="rounded-full px-3 py-1.5 font-ui text-sm font-bold" style={{ color: LIVE_RED }}>Send</button>}
            </form>
          ) : (
            <button type="button" onClick={comment.onClick} className="min-w-0 flex-1 truncate rounded-full bg-white/15 px-4 py-2.5 text-left text-sm text-white/80 backdrop-blur-md">{comment.label}</button>
          )}
          {onGift && <button type="button" onClick={onGift} aria-label="Send a gift" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF6B8B] to-[#FE2C55] text-lg shadow-md">🎁</button>}
          <button type="button" onClick={() => like()} aria-label="Send hearts" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl backdrop-blur-md" style={{ color: LIVE_RED }}>♥</button>
        </div>
      )}
      {!idle && comment?.kind === "input" && (sendErr || comment.note) && <p className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)_+_3.6rem)] text-xs text-[#FFB4C6]" role="alert">{sendErr || comment.note}</p>}

      {moreOpen && (
        <Sheet label="More" onClose={() => setMoreOpen(false)}>
          <ul className="divide-y divide-white/10">
            {more.map((m) => (
              <li key={m.label}>
                {m.href ? <Link href={m.href} className="block px-1 py-3.5 font-ui text-sm font-semibold">{m.label}</Link>
                  : <button type="button" aria-pressed={m.pressed} onClick={() => { setMoreOpen(false); m.onClick?.(); }} className="flex w-full items-center justify-between px-1 py-3.5 text-left font-ui text-sm font-semibold">{m.label}{m.pressed !== undefined && <span className={`text-xs ${m.pressed ? "text-[#FF6B8B]" : "text-white/50"}`}>{m.pressed ? "On" : "Off"}</span>}</button>}
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      {viewersOpen && (
        <Sheet label="Viewers" onClose={() => setViewersOpen(false)}>
          <p className="font-ui text-sm font-bold">{watching.toLocaleString("en-GB")} watching</p>
          <ul className="mt-3 max-h-[45vh] space-y-2.5 overflow-y-auto">
            {[...faces.filter((f) => f.badge), ...(viewers ?? [])].filter((p, i, all) => all.findIndex((q) => q.key === p.key) === i).map((p) => (
              <li key={p.key} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.avatar ? <img src={p.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-bold">{p.name.slice(0, 1)}</span>}
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                {p.badge && <span className="rounded bg-white/10 px-1.5 py-px text-[10px] uppercase tracking-wide text-white/70">{p.badge}</span>}
              </li>
            ))}
          </ul>
          {loadViewers && viewers === null && <p className="mt-2 text-xs text-white/55">Loading…</p>}
          {!loadViewers && <p className="mt-3 text-xs text-white/55">Join #NotesApp to see who else is here.</p>}
        </Sheet>
      )}
      <Sounds sounds={sounds} onBlocked={setBlocked} />
      {children}
    </div>
  );
}

// A live in the feed that can't play here (ended, for followers, a paid live, not for guests…): its picture, why, and what to do.
export function FeedGate({ poster, ended, eyebrow, heading, title, body, onClose, children }: { poster?: string; ended?: boolean; eyebrow?: string; heading?: string; title: string; body?: string; onClose?: () => void; children?: ReactNode }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-black px-6 text-center text-white lg:rounded-2xl" data-live-gate>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {poster ? <img src={poster} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl" /> : <div className="absolute inset-0 bg-gradient-to-b from-[#3a0a18] to-black" />}
      {onClose && <button type="button" onClick={onClose} aria-label="Close Notes Live" className="absolute right-3 top-[calc(env(safe-area-inset-top)_+_0.75rem)] flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-2xl leading-none lg:hidden">×</button>}
      <div className="relative max-w-sm">
        {eyebrow !== undefined && <span className="rounded-[4px] px-1.5 py-0.5 font-ui text-[11px] font-extrabold tracking-wide" style={{ background: ended ? "#555" : LIVE_RED }}>{ended ? "ENDED" : "LIVE"}</span>}
        {eyebrow && <p className="mt-3 font-ui text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{eyebrow}</p>}
        {heading && <p className="mt-1 font-display text-3xl leading-tight">{heading}</p>}
        <h2 className="mt-4 font-ui text-lg font-bold">{title}</h2>
        {body && <p className="mt-1 text-sm text-white/75">{body}</p>}
        {children}
      </div>
    </div>
  );
}

// A sheet that slides up inside the player (the comments and the picture stay behind it).
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/50 lg:rounded-2xl" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-[#17110f] p-4 pb-[calc(env(safe-area-inset-bottom)_+_1rem)] text-white" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between"><p className="font-ui text-xs font-semibold uppercase tracking-[0.2em] text-white/50">{label}</p>
          <button type="button" onClick={onClose} className="px-2 text-xl text-white/60 hover:text-white" aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}
