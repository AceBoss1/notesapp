"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShareMenu } from "@/components/share/ShareToNotesApp";
import { GUEST_BEAT_MS, GUEST_NO_TEXT } from "@/lib/live-guests";
import type { GuestView } from "@/lib/live-guests-server";
import LivePlayer, { FeedGate, FollowPlus } from "./LivePlayer";

// Watching a live without an account (docs/GUEST_LIVES.md; the approved mockups are docs/mockups/guest-lives). The live plays, with
// the chat to read, the count and the likes; chatting, hearts, gifts and following open a sheet to join, which brings them back here.
// Everything comes from /api/lives/watch: a guest never reads Firestore, and their relay session only ever receives.
type Track = { uid: string; mid: string; kind?: "video" };
type RelayRes = { offer?: { type: "offer"; sdp: string } | null; renegotiate?: boolean; tracks?: Track[]; ok?: boolean };
type Action = "chat" | "heart" | "gift" | "follow";
const ACTION_TEXT: Record<Action, string> = { chat: "chat with", heart: "send a heart to", gift: "send a gift to", follow: "follow" };

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch("/api/lives/watch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "Something went wrong."), { status: r.status });
  return d as T;
}

// feed: inside Notes Live's swipe feed (components/lives/LiveFeed.tsx): the full-screen player (components/lives/LivePlayer.tsx), and
// watching starts as the live snaps into view (the swipe is the tap), instead of the ▶ Watch button.
export default function GuestLive({ id, feed }: { id: string; feed?: { onClose: () => void } }) {
  const [v, setV] = useState<GuestView | null>(null);
  const [err, setErr] = useState("");
  const [watching, setWatching] = useState(false);
  const [note, setNote] = useState(true);
  const [sheet, setSheet] = useState<Action | null>(null);
  const [share, setShare] = useState(false);
  const [videos, setVideos] = useState<Record<string, MediaStream>>({});
  const [sounds, setSounds] = useState<Record<string, MediaStream>>({});
  const [trouble, setTrouble] = useState("");
  const viewRef = useRef<GuestView | null>(null);
  const syncRef = useRef<(g: GuestView) => void>(() => {});

  // What a guest sees, every three seconds (the server shares one copy per live between all its guests).
  useEffect(() => {
    let dead = false;
    const load = () => fetch(`/api/lives/watch?id=${encodeURIComponent(id)}`, { cache: "no-store" }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "That live wasn't found.");
      if (dead) return;
      viewRef.current = d as GuestView; setV(d as GuestView); syncRef.current(d as GuestView);
    }).catch((e) => { if (!dead) setErr(e.message); });
    void load();
    const t = window.setInterval(load, 3_000);
    return () => { dead = true; window.clearInterval(t); };
  }, [id]);

  // Watching: a seat, a beat, and one receive-only connection to the relay that follows the stage.
  useEffect(() => {
    if (!watching) return;
    let over = false, pc: RTCPeerConnection | null = null, fresh = true;
    const pulled = new Map<string, { uid: string; mid: string; video: boolean }>();
    const midTo = new Map<string, { uid: string; video: boolean }>();
    const vids: Record<string, MediaStream> = {}, auds: Record<string, MediaStream> = {};
    let queue: Promise<unknown> = Promise.resolve();
    const serial = (fn: () => Promise<void>) => { queue = queue.then(fn, fn).catch(() => {}); return queue; };
    const relay = async (body: Record<string, unknown>) => { const r = await call<RelayRes>({ action: "relay", id, ...body, ...(fresh ? { fresh: true } : {}) }); fresh = false; return r; };
    const sync = (g: GuestView) => serial(async () => {
      if (over || !pc || g.no) return;
      const want = [...g.stage.filter((s) => s.sound).map((s) => ({ uid: s.uid, key: `a:${s.sound}`, video: false })), ...g.stage.filter((s) => s.video).map((s) => ({ uid: s.uid, key: `v:${s.video}`, video: true }))];
      const keys = new Set(want.map((w) => w.key));
      const gone = [...pulled].filter(([k]) => !keys.has(k));
      for (const [k, x] of gone) { pulled.delete(k); midTo.delete(x.mid); delete (x.video ? vids : auds)[x.uid]; }
      if (gone.length) { setVideos({ ...vids }); setSounds({ ...auds }); await relay({ op: "close", mids: gone.map(([, x]) => x.mid) }).catch(() => {}); }
      for (const video of [false, true]) {
        const add = want.filter((w) => w.video === video && !pulled.has(w.key));
        if (!add.length) continue;
        const res = await relay({ op: "pull", uids: add.map((a) => a.uid), ...(video ? { video: true } : {}) }).catch(() => null);
        if (!res?.tracks?.length || !res.offer) continue;
        for (const t of res.tracks) { const w = add.find((a) => a.uid === t.uid); if (w) { pulled.set(w.key, { uid: t.uid, mid: t.mid, video }); midTo.set(t.mid, { uid: t.uid, video }); } }
        await pc.setRemoteDescription(res.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (res.renegotiate) await relay({ op: "answer", answer: { type: answer.type, sdp: answer.sdp ?? "" } });
      }
    });
    (async () => {
      try {
        const { iceServers } = await call<{ iceServers: RTCIceServer[] }>({ action: "join", id });
        if (over) return;
        pc = new RTCPeerConnection({ iceServers, bundlePolicy: "max-bundle" });
        pc.ontrack = (e) => {
          const who = e.transceiver?.mid ? midTo.get(e.transceiver.mid) : undefined;
          if (!who) return;
          const st = new MediaStream([e.track]);
          if (who.video) { vids[who.uid] = st; setVideos({ ...vids }); } else { auds[who.uid] = st; setSounds({ ...auds }); }
        };
        pc.onconnectionstatechange = () => { if (pc?.connectionState === "failed" && !over) setTrouble("Lost the connection to the live. Tap Watch again."); };
        syncRef.current = (g) => { void sync(g); };
        if (viewRef.current) void sync(viewRef.current);
      } catch (e) {
        setTrouble(e instanceof Error ? (GUEST_NO_TEXT[e.message as keyof typeof GUEST_NO_TEXT]?.title ?? e.message) : "Couldn't open the live.");
        setWatching(false);
      }
    })();
    const beat = window.setInterval(() => { void call({ action: "beat", id }).catch(() => {}); }, GUEST_BEAT_MS);
    const bye = () => navigator.sendBeacon?.("/api/lives/watch", new Blob([JSON.stringify({ action: "leave", id })], { type: "application/json" }));
    window.addEventListener("pagehide", bye);
    return () => {
      over = true; window.clearInterval(beat); window.removeEventListener("pagehide", bye);
      syncRef.current = () => {};
      pc?.close(); void call({ action: "leave", id }).catch(() => {});
    };
  }, [watching, id]);

  // In the feed: start watching once, as soon as the live is known to be open to guests.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!feed || autoStarted.current || !v || v.no) return;
    autoStarted.current = true; setWatching(true);
  }, [feed, v]);
  const askedOnHeart = useRef(false);

  const back = `/live/${id}?from=guest`;
  const joinSheet = sheet && v ? (
    <div className="absolute inset-0 z-30 flex items-end bg-black/45" role="dialog" aria-modal="true" aria-label="Join #NotesApp" onClick={() => setSheet(null)}>
      <div className="w-full rounded-t-3xl bg-card p-5 text-center text-ink" onClick={(e) => e.stopPropagation()}>
        <p className="text-3xl" aria-hidden>{sheet === "gift" ? "🎁" : sheet === "heart" ? "❤️" : sheet === "follow" ? "➕" : "💬"}</p>
        <h2 className="mt-1 font-display text-2xl">Join #NotesApp to {ACTION_TEXT[sheet]} {v.host.name}</h2>
        <p className="mt-1 text-sm text-slate">Free. You&apos;ll come straight back to this live.</p>
        <Link href={`/signup?next=${encodeURIComponent(back)}`} className="btn-primary mt-4 block w-full">Create a free account</Link>
        <Link href={`/login?next=${encodeURIComponent(back)}`} className="mt-2 block w-full rounded-full border border-rule py-2.5 font-ui text-sm font-bold">I have an account: sign in</Link>
        <button type="button" onClick={() => setSheet(null)} className="mt-3 text-xs text-slate underline">Keep watching</button>
      </div>
    </div>
  ) : null;

  if (feed) {
    if (err) return <FeedGate title="Couldn't open this live" body={err} onClose={feed.onClose} />;
    if (!v) return <LivePlayer idle title="" host={{ name: "", username: "", avatar: "" }} watching={0} likes={0} status="Loading…" onClose={feed.onClose} />;
    if (v.no) {
      const t = GUEST_NO_TEXT[v.no];
      return (
        <FeedGate poster={v.poster || v.host.avatar} ended={v.status !== "live"} eyebrow={`${v.host.name}${v.host.username ? ` · @${v.host.username}` : ""}`} heading={v.title}
          title={v.no === "ended" ? "This live has ended" : t.title.replace("the host's", `${v.host.name}'s`)} body={v.no === "ended" ? `See ${v.host.name}'s replays and what's next on their profile.` : t.body} onClose={feed.onClose}>
          {v.no === "ended" ? (v.host.username && <Link href={`/u/${v.host.username}`} className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 font-ui text-sm font-bold text-ink">See @{v.host.username}&apos;s profile</Link>) : (
            <>
              <Link href={`/login?next=${encodeURIComponent(v.no === "paid" ? "/lives/paid" : back)}`} className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 font-ui text-sm font-bold text-ink">{t.button}</Link>
              <p className="mt-2 text-xs text-white/70">No account yet? <Link href={`/signup?next=${encodeURIComponent(back)}`} className="font-bold text-white underline">Join #NotesApp free</Link></p>
            </>
          )}
        </FeedGate>
      );
    }
    const lead = v.stage.find((s) => videos[s.uid]);
    return (
      <LivePlayer title={v.title} host={v.host} watching={v.watching} likes={v.likes}
        video={lead ? videos[lead.uid] : null} poster={v.poster}
        extraVideos={v.stage.filter((s) => s.uid !== lead?.uid && videos[s.uid]).map((s) => ({ key: s.uid, stream: videos[s.uid], label: s.name }))}
        sounds={Object.entries(sounds).map(([uid, st]) => ({ key: uid, stream: st }))}
        lines={v.chat.map((m) => ({ id: m.id, name: m.name, text: m.text, ...(m.ev ? { ev: m.ev } : {}) }))} pinned={v.pinned}
        faces={v.stage.map((s, i) => ({ key: s.uid, name: s.name, avatar: s.avatar, badge: i === 0 ? "Host" : "On stage" }))}
        follow={v.host.username ? <FollowPlus username={v.host.username} onGuest={() => setSheet("follow")} /> : null}
        onClose={feed.onClose} onLike={() => { if (!askedOnHeart.current) { askedOnHeart.current = true; setTimeout(() => setSheet("heart"), 700); } }}
        onGift={() => setSheet("gift")} onShare={() => setShare(true)}
        more={[{ label: "Sign in", href: `/login?next=${encodeURIComponent(back)}` }, { label: "Join #NotesApp free", href: `/signup?next=${encodeURIComponent(back)}` }, { label: "🎟 Paid lives", href: "/lives/paid" }]}
        comment={{ kind: "prompt", label: "Sign in to comment…", onClick: () => setSheet("chat") }}
        status={watching && !Object.keys(sounds).length && !lead ? "Connecting…" : ""}
        notice={note ? (
          <div className="flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs text-ink" role="note">
            <span aria-hidden>👀</span>
            <span>You&apos;re watching as a guest. <Link href={`/login?next=${encodeURIComponent(back)}`} className="font-bold text-crimson">Sign in</Link> to comment, send a gift or follow {v.host.name}.</span>
            <button type="button" onClick={() => setNote(false)} className="ml-auto px-1 font-bold" aria-label="Close">✕</button>
          </div>
        ) : null}>
        {!watching && autoStarted.current && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/40">
            <button type="button" onClick={() => { setTrouble(""); setWatching(true); }} className="rounded-full bg-white px-6 py-3 font-ui text-base font-bold text-crimson shadow-lg">▶ Watch again</button>
            {trouble && <span className="max-w-xs text-center text-xs text-[#ffd6e0]" role="alert">{trouble}</span>}
          </div>
        )}
        {joinSheet}
        {share && <ShareMenu shareRef={null} url={`${window.location.origin}/live/${id}`} title={`${v.host.name} is live: ${v.title}`} onClose={() => setShare(false)} />}
      </LivePlayer>
    );
  }

  if (err) return <p className="card p-6 text-sm text-crimson">{err}</p>;
  if (!v) return <p className="text-sm text-slate">Loading…</p>;

  // Lives a guest can't watch, and a live that has ended (screens 5 and 7).
  if (v.no) {
    const t = GUEST_NO_TEXT[v.no];
    return (
      <div className="card overflow-hidden text-center">
        <div className="relative flex aspect-video items-center justify-center bg-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {v.poster ? <img src={v.poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" /> : null}
          <span className="relative rounded-md bg-[#E0123E] px-2 py-1 font-ui text-xs font-extrabold tracking-wide text-white">{v.status === "live" ? "LIVE" : "ENDED"}</span>
        </div>
        <div className="p-6">
          <p className="font-ui text-xs font-semibold uppercase tracking-[0.2em] text-crimson">{v.host.name}{v.host.username ? ` · @${v.host.username}` : ""}</p>
          <h1 className="mt-1 font-display text-3xl text-ink">{v.title}</h1>
          <h2 className="mt-4 font-ui text-lg font-bold text-ink">{v.no === "ended" ? "This live has ended" : t.title.replace("the host's", `${v.host.name}'s`)}</h2>
          {v.no === "ended" ? (
            <>
              <p className="mt-1 text-sm text-slate">See {v.host.name}&apos;s replays and what&apos;s next on their profile.</p>
              <div className="mt-4 flex flex-col items-center gap-2">
                {v.host.username && <Link href={`/u/${v.host.username}`} className="btn-primary">See @{v.host.username}&apos;s profile</Link>}
                <Link href={`/login?next=${encodeURIComponent(v.host.username ? `/u/${v.host.username}` : "/")}`} className="text-sm text-crimson underline">Sign in to follow {v.host.name} so you don&apos;t miss the next one</Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate">{t.body}</p>
              <Link href={`/login?next=${encodeURIComponent(v.no === "paid" ? `/lives/paid` : back)}`} className="btn-primary mt-4 inline-block">{t.button}</Link>
              <p className="mt-2 text-xs text-slate">No account yet? <Link href={`/signup?next=${encodeURIComponent(back)}`} className="text-crimson underline">Join #NotesApp free</Link></p>
            </>
          )}
        </div>
      </div>
    );
  }

  // The live (screen 2).
  // The host's camera if it's on (the host is first on the stage), otherwise the first speaker's.
  const main = v.stage.find((s) => videos[s.uid]);
  const rb = "flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-lg text-white backdrop-blur";
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink text-white" style={{ minHeight: 560 }}>
      {main ? <Video stream={videos[main.uid]} /> : (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {v.poster || v.host.avatar ? <img src={v.poster || v.host.avatar} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
        </div>
      )}
      {Object.entries(sounds).map(([uid, st]) => <Sound key={uid} stream={st} />)}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {v.host.avatar ? <img src={v.host.avatar} alt="" className="h-9 w-9 rounded-full border-2 border-[#E0123E] object-cover" /> : null}
          <div className="min-w-0 text-sm leading-tight"><b className="block truncate">{v.host.name}</b><span className="block truncate opacity-85">{v.title}</span></div>
          <span className="ml-auto rounded bg-[#E0123E] px-1.5 py-0.5 text-[11px] font-extrabold">LIVE</span>
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold" aria-label={`${v.watching} watching`}>👁 {v.watching.toLocaleString("en-GB")}</span>
        </div>
        {note && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs text-ink" role="note">
            <span aria-hidden>👀</span>
            <span>You&apos;re watching as a guest. <Link href={`/login?next=${encodeURIComponent(back)}`} className="font-bold text-crimson">Sign in</Link> to chat, send a gift or follow {v.host.name}.</span>
            <button type="button" onClick={() => setNote(false)} className="ml-auto px-1 font-bold" aria-label="Close">✕</button>
          </div>
        )}
      </div>
      {!watching && (
        <div className="absolute inset-0 flex flex-col items-center justify-start gap-2 bg-black/35 pt-[38%]">
          <button type="button" onClick={() => { setTrouble(""); setWatching(true); }} className="rounded-full bg-white px-6 py-3 font-ui text-base font-bold text-crimson shadow-lg">▶ Watch {v.stage.some((s) => s.video) ? "" : "and listen"}</button>
          <span className="text-xs opacity-90">No account needed to watch</span>
          {trouble && <span className="max-w-xs text-center text-xs text-[#ffd6e0]" role="alert">{trouble}</span>}
        </div>
      )}
      <ul className="absolute bottom-20 left-3 right-16 flex max-h-56 flex-col justify-end gap-1 overflow-hidden text-[13px] leading-snug" aria-live="polite" aria-label="Chat">
        {v.pinned && <li className="mb-1 rounded-lg bg-black/45 px-2 py-1">📌 {v.pinned}</li>}
        {v.chat.slice(-8).map((m) => <li key={m.id} className="drop-shadow" style={{ textShadow: "0 1px 2px #000" }}>{m.ev ? <i className="opacity-85">{m.name} {m.text}</i> : <><b className="text-[#FFD6E0]">{m.name}</b> {m.text}</>}</li>)}
      </ul>
      <div className="absolute bottom-20 right-3 flex flex-col items-center gap-2.5">
        <button type="button" className={rb} onClick={() => setSheet("heart")} aria-label="Send a heart">❤️</button>
        <button type="button" className={rb} onClick={() => setSheet("gift")} aria-label="Send a gift">🎁</button>
        <button type="button" className={rb} onClick={() => setShare(true)} aria-label="Share this live">↗︎</button>
      </div>
      <div className="absolute inset-x-3 bottom-3 flex gap-2">
        <button type="button" onClick={() => setSheet("chat")} className="flex-1 rounded-full bg-white/95 py-3 font-ui text-sm font-bold text-crimson">Sign in to chat</button>
        <button type="button" onClick={() => setSheet("follow")} className="rounded-full bg-crimson px-4 py-3 font-ui text-sm font-bold text-white">Follow</button>
      </div>

      {joinSheet}
      {share && <ShareMenu shareRef={null} url={`${window.location.origin}/live/${id}`} title={`${v.host.name} is live: ${v.title}`} onClose={() => setShare(false)} />}
    </div>
  );
}

function Video({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />;
}
function Sound({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) { ref.current.srcObject = stream; void ref.current.play().catch(() => {}); } }, [stream]);
  return <audio ref={ref} autoPlay />;
}
