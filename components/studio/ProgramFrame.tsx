"use client";

import { useEffect, useRef, useState } from "react";
import { TICKER_SECONDS, clipOffset, layoutFor, programTiles, type StudioClip, type StudioState } from "@/lib/studio";
import "./program.css";

// The programme: what everyone in a live sees when the host has the studio on (lib/studio.ts). The cameras (or each person's picture
// while their camera is off) in the chosen layout, and over them the logo and LIVE badge, the lower third, the subtitle line, the
// viewer's comment on air, the ticker, the sponsor spot, and a clip when one is playing. Drawn the same on every screen from the
// room's `studio` object; nothing here sends anything.
export type ProgramPerson = { name: string; avatar: string };
const NA_MARK = "/images/brand/icon-192.png";
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "•";

export default function ProgramFrame({ studio, stage, hostUid, me, person, videos, myCam, talking, sub }: {
  studio: StudioState; stage: string[]; hostUid: string; me: string;
  person: (uid: string) => ProgramPerson;
  videos: Record<string, MediaStream>; myCam: MediaStream | null;
  talking?: Record<string, boolean>;
  sub?: (uid: string) => string; // the small line beside a name on its tile ("Host", "Moderator")
}) {
  const tiles = programTiles(studio, stage, hostUid);
  const layout = layoutFor(studio.layout, tiles.length, !!studio.screen);
  const streamOf = (u: string) => (u === me ? myCam : videos[u] ?? null);
  const tile = (u: string) => (
    <Tile key={u} name={u === me ? `${person(u).name} (you)` : person(u).name} avatar={person(u).avatar} sub={sub?.(u) ?? ""} stream={streamOf(u)}
      mirror={u === me && studio.screen !== u} whole={studio.screen === u} talking={!!talking?.[u]} />
  );
  const cols = layout === "row" ? (tiles.length === 3 ? "1.25fr 1fr 1fr" : `repeat(${tiles.length}, 1fr)`) : layout === "grid" ? `repeat(${tiles.length <= 4 ? 2 : 3}, 1fr)` : undefined;
  const { bug, lower, ticker } = studio;
  const showLower = lower.on && !!(lower.head || lower.name);
  return (
    <div className="nls" data-theme={studio.theme} role="img" aria-label={`The live programme${showLower && lower.head ? `: ${lower.head}` : ""}`}>
      <div className="nls-col">
        <div className="nls-top">
          {bug.live && <span className="nls-live"><span className="nls-dot" />LIVE</span>}
          {bug.place && <span className="nls-place">{bug.place}</span>}
          {bug.on && (
            <span className="nls-bug">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bug.logo || NA_MARK} alt="" />
              {bug.show && <span>{bug.show}</span>}
            </span>
          )}
        </div>
        <div className="nls-tiles" data-layout={layout} style={cols ? { gridTemplateColumns: cols } : layout === "spotlight" ? { gridTemplateRows: `repeat(${tiles.length - 1}, 1fr)` } : undefined}>
          {layout === "pip" ? <>{tile(tiles[0])}<div className="nls-pips">{tiles.slice(1).map(tile)}</div></> : tiles.map(tile)}
          {!tiles.length && <div className="nls-tile"><div className="nls-face"><span>•</span></div></div>}
        </div>
        {studio.caption && <p className="nls-cap" aria-live="polite">{studio.caption}</p>}
        {studio.sponsor?.slot === "banner" && <Sponsor s={studio.sponsor} />}
        {(showLower || studio.comment) && (
          <div className="nls-low">
            {showLower && (
              <div className="nls-l3" data-style={lower.style} key={`${lower.style}${lower.head}${lower.name}`}>
                {lower.style !== "name" && (lower.kicker || lower.style === "breaking") && <span className="nls-kick">{lower.kicker || "Breaking"}</span>}
                {lower.style !== "name" && lower.head && <div className="nls-head">{lower.head}</div>}
                {lower.name && <span className="nls-who"><b>{lower.name}</b>{lower.role}</span>}
              </div>
            )}
            {studio.comment && (
              <div className="nls-vc" key={studio.comment.id}>
                <div className="nls-vc-h"><span>VIEWER COMMENT</span><span>on NotesApp</span></div>
                <div className="nls-vc-b">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {studio.comment.avatar ? <img src={studio.comment.avatar} alt="" /> : <span>{initials(studio.comment.name)}</span>}
                  <div style={{ minWidth: 0 }}><div className="nls-vc-n">{studio.comment.name}</div><p>{studio.comment.text}</p></div>
                </div>
              </div>
            )}
          </div>
        )}
        {ticker.on && ticker.lines.length > 0 && <Ticker tag={ticker.tag} lines={ticker.lines} seconds={TICKER_SECONDS[ticker.speed]} clock={bug.clock} />}
      </div>
      {studio.sponsor?.slot === "corner" && <Sponsor s={studio.sponsor} />}
      {studio.clip && <Clip key={studio.clip.at} clip={studio.clip} />}
    </div>
  );
}

function Tile({ name, avatar, sub, stream, mirror, whole, talking }: { name: string; avatar: string; sub: string; stream: MediaStream | null; mirror: boolean; whole: boolean; talking: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className="nls-tile" data-talking={talking ? "1" : "0"}>
      {stream
        ? <video ref={ref} autoPlay playsInline muted data-fit={whole ? "contain" : "cover"} style={mirror ? { transform: "scaleX(-1)" } : undefined} />
        // eslint-disable-next-line @next/next/no-img-element
        : <div className="nls-face">{avatar ? <img src={avatar} alt="" /> : <span>{initials(name)}</span>}</div>}
      <div className="nls-strap"><b>{name}</b>{sub && <i>{sub}</i>}</div>
    </div>
  );
}

function Sponsor({ s }: { s: NonNullable<StudioState["sponsor"]> }) {
  return (
    <div className="nls-sp" data-slot={s.slot}>
      {/* A sponsor's video never has sound (owner, 15 Nov 2026). */}
      {s.kind === "video"
        ? <video src={s.url} autoPlay loop muted playsInline />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={s.url} alt={s.label || "Sponsor"} />}
      <em>{s.label || "Sponsored"}</em>
    </div>
  );
}

// The ticker: the lines run right to left without a gap (the list is drawn twice and moved by half its width).
function Ticker({ tag, lines, seconds, clock }: { tag: string; lines: string[]; seconds: number; clock: boolean }) {
  const chars = lines.reduce((n, l) => n + l.length + 6, 0);
  const [time, setTime] = useState("");
  useEffect(() => {
    if (!clock) return;
    const tick = () => setTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 20_000);
    return () => clearInterval(t);
  }, [clock]);
  return (
    <div className="nls-tick">
      {tag && <span className="nls-tick-tag">{tag}</span>}
      <div className="nls-tick-run">
        <div className="nls-tick-move" style={{ animationDuration: `${Math.max(14, (chars / 100) * seconds).toFixed(1)}s` }}>
          {[0, 1].map((k) => <div key={k} aria-hidden={k === 1} style={{ display: "flex" }}>{lines.map((l, i) => <span key={i}>{l}</span>)}</div>)}
        </div>
      </div>
      {clock && time && <span className="nls-clock">{time}</span>}
    </div>
  );
}

// A clip playing for everyone, from where it has reached (someone joining late doesn't see it from the start). A video or a sound
// that the browser won't start with sound starts silent, with a button to turn the sound on. When it ends, the picture comes back.
function Clip({ clip }: { clip: StudioClip }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [done, setDone] = useState(false);
  const [silent, setSilent] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || clip.kind === "image") return;
    const start = () => {
      const at = clipOffset(clip);
      if (Number.isFinite(el.duration) && at >= el.duration) { setDone(true); return; }
      if (at > 1) { try { el.currentTime = at; } catch { /* not seekable yet: plays from the start */ } }
      el.play().catch(() => { el.muted = true; setSilent(true); el.play().catch(() => {}); });
    };
    if (el.readyState >= 1) start(); else el.addEventListener("loadedmetadata", start, { once: true });
    return () => el.removeEventListener("loadedmetadata", start);
  }, [clip]);
  if (done) return null;
  const sound = silent && <button type="button" className="nls-sound" onClick={() => { if (ref.current) { ref.current.muted = false; setSilent(false); } }}>🔊 Tap for sound</button>;
  if (clip.kind === "audio") {
    return <>
      <audio ref={ref} src={clip.url} onEnded={() => setDone(true)} onError={() => setDone(true)} />
      <span className="nls-note">♪ {clip.label || "Playing a sound"}</span>{sound}
    </>;
  }
  return (
    <div className="nls-clip">
      {clip.kind === "video"
        ? <video ref={ref} src={clip.url} playsInline onEnded={() => setDone(true)} onError={() => setDone(true)} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={clip.url} alt={clip.label} />}
      {clip.ad && <span className="nls-clip-tag">Advertisement</span>}
      {sound}
    </div>
  );
}
