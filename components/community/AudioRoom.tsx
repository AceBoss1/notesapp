"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, limitToLast, onSnapshot, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Avatar from "@/components/Avatar";
import { MicIcon } from "@/components/calls/CallViews";
import { duration } from "@/lib/calls";
import { DEFAULT_ROOM_FIGURES, ROOM_BEAT_MS, ROOM_CHAT_MAX, ROOM_SPEAKERS_MAX, linksFor, listenerCount, listenersOf, pullsFor, roomRole, stageOf, type RoomChat, type RoomDoc, type RoomFigures, type RoomLink, type RoomLinkKind, type RoomMode } from "@/lib/rooms";
import { AUDIO_ONLY_KEY, CHALLENGE_POSTER, anyVideo, canVideo, chooseAudioOnly, minutesLeftText, videoConstraints, videoEncoding, videoPullsFor, type HostLive, type NetInfo, type PosterSource } from "@/lib/rooms-live";
import { uploadToR2 } from "@/lib/upload";
import { ago, capi, field } from "./api";
import { RECORDING_HELP, RECORDING_NOTICE, isRecorded, recordingPrompt, type RecordingFigures } from "@/lib/live-recording";
import { useLiveChannel, type LiveChannel } from "./useLiveChannel";
import type { LiveHand } from "@/lib/live-rooms";

// Audio rooms (lib/rooms.ts): the live rooms on a community's Home, and the room itself. A room runs in the mode it opened with:
// - "p2p": on stage, phones connect to each other; each listener connects to the host, whose phone mixes the stage (Web Audio) into the
//   one stream it sends them.
// - "relay": one connection per person to the Cloudflare relay. The host and speakers send their microphone up once (push); everyone
//   receives the other stage microphones from the relay (pull). Every step goes through /api/community/rooms (action "relay"), which
//   checks who may send and receive; the browser never holds Cloudflare's token or anyone's session.
// - Live mode (relay rooms, lib/rooms-live.ts): the host (and speakers, if the host allows) can turn a camera on as a second track on the
//   same connection, capped by the settings, and off again without reconnecting. While no camera is up, everyone sees the host's poster
//   (a picture, never video). A viewer on Audio only never pulls the cameras. The host's beat brings their video minutes and prompts.

type Ice = { urls: string | string[]; username?: string; credential?: string }[];
type Card = { id: string; title: string; hostName: string; listening: number; speakers: string[]; recorded?: boolean; faces: { name: string; avatar: string }[] };
type RelayRes = { answer?: RTCSessionDescriptionInit; offer?: RTCSessionDescriptionInit | null; renegotiate?: boolean; tracks?: { uid: string; mid: string; kind?: "audio" | "video" }[]; host?: HostLive };
type VideoCfg = { on: boolean; kbps: number; fps: number; height: number };
// Audio only, from this device's choice or its connection (lib/rooms-live.ts chooseAudioOnly). Storage can be missing: then the default.
const readAudioOnly = () => {
  let stored: string | null = null;
  try { stored = localStorage.getItem(AUDIO_ONLY_KEY); } catch { /* private window */ }
  const net = typeof navigator !== "undefined" ? (navigator as Navigator & { connection?: NetInfo }).connection : undefined;
  return chooseAudioOnly(stored, net);
};
type RecChoice = RecordingFigures & { canRecord: boolean };

export function RoomsCard({ cid, canHost, onOpen }: { cid: string; canHost: boolean; onOpen: (id: string, title?: string) => void }) {
  const [rooms, setRooms] = useState<Card[] | null>(null);
  const [figures, setFigures] = useState<RoomFigures>(DEFAULT_ROOM_FIGURES);
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [poster, setPoster] = useState<{ source: PosterSource; url?: string; preview?: string }>({ source: "none" });
    // Recording (lib/live-recording.ts): off by default; hidden with a note while the recorder isn't set up; ticked and fixed when forced.
  const [rec, setRec] = useState<RecChoice | null>(null);
  const [record, setRecord] = useState(false);
    const load = useCallback(() => capi<{ rooms: Card[]; figures?: RoomFigures; recording?: RecChoice | null }>(`/api/community/rooms?cid=${cid}`).then((d) => { setRooms(d.rooms); if (d.figures) setFigures(d.figures); setRec(d.recording ?? null); }).catch(() => setRooms([])), [cid]);
  useEffect(() => { load(); const t = setInterval(load, 20_000); return () => clearInterval(t); }, [load]);
  if (rooms === null || (!rooms.length && !canHost)) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-rule bg-card" aria-labelledby="rooms-h">
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-crimson-deep to-crimson px-4 py-3 text-paper">
        <p id="rooms-h" className="flex items-center gap-2 font-ui text-sm font-bold"><span aria-hidden className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-paper/70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-paper" /></span>Audio rooms</p>
        {canHost && !open && <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-paper/15 px-3 py-1 font-ui text-xs font-semibold hover:bg-paper/25">+ Start a room</button>}
      </div>
      {open && (
        <form className="flex flex-wrap items-center gap-2 border-b border-rule p-4" onSubmit={async (e) => {
          e.preventDefault(); setErr("");
          try { const r = await capi<{ id: string }>("/api/community/rooms", { action: "start", cid, title, record: !!rec?.forced || (record && !!rec?.canRecord), ...(poster.source !== "none" ? { poster: { source: poster.source, url: poster.url } } : {}) }); setOpen(false); setTitle(""); setPoster({ source: "none" }); onOpen(r.id, title); }
          catch (x) { setErr(x instanceof Error ? x.message : "Couldn't start the room."); }
        }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="What's it about? e.g. Sunday Q&A" aria-label="Room name" className={`${field} min-w-0 flex-1`} />
          <button className="btn-primary !px-4 !py-2 text-xs" disabled={title.trim().length < 3}>Go live</button>
          <button type="button" className="text-xs text-slate underline" onClick={() => setOpen(false)}>Cancel</button>
          {err && <p className="w-full text-sm text-crimson" role="alert">{err}</p>}
          <div className="w-full"><PosterChoice value={poster} onChange={setPoster} onError={setErr} light /></div>
          {rec?.canRecord && figures.relay
            ? <label className="flex w-full items-start gap-2 text-xs text-ink"><input type="checkbox" checked={rec.forced || record} disabled={rec.forced} onChange={(e) => setRecord(e.target.checked)} className="mt-0.5 h-4 w-4 accent-crimson" />
                <span><b>Record this live</b>{rec.forced ? " (every live is recorded for safety for now)" : ""}. Everyone who joins is told, speakers agree before their mic goes on, and you agree too. Kept {rec.keepDays} days, then deleted unless you publish the replay. <a href={RECORDING_HELP} className="underline" target="_blank" rel="noreferrer">More</a></span></label>
            : <p className="w-full text-xs text-slate">{rec && !rec.available ? "Recording isn't available yet." : rec && !figures.relay ? "Recording needs the relay, which isn't on yet." : ""}</p>}
          <p className="w-full text-xs text-slate">You host: bring up to {ROOM_SPEAKERS_MAX} members on stage to speak; everyone else listens and can raise a hand. Up to {figures.listeners.toLocaleString("en-GB")} listeners{figures.relay ? "" : " for now"}. {rec?.forced || record ? "This live will be recorded." : "Nothing is recorded."}{figures.relay && figures.live?.video ? ` You can turn video on during the room (${figures.live.budgetMinutes} video minutes a live); the poster shows while it's off.` : ""}</p>
        </form>
      )}
      {rooms.length ? (
        <ul className="divide-y divide-rule">
          {rooms.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-ui text-sm font-bold text-ink">{r.title}</p>
                <p className="text-xs text-slate">with {r.hostName}{r.speakers.length ? ` +${r.speakers.length} on stage` : ""} · {r.listening} in the room{r.recorded ? <span className="text-crimson"> · ● Recorded</span> : null}</p>
                <span className="mt-2 flex -space-x-2">{r.faces.map((f, i) => <Avatar key={i} src={f.avatar} alt={f.name} size={28} className="!h-7 !w-7 rounded-full ring-2 ring-card" />)}</span>
              </div>
              <button type="button" onClick={() => onOpen(r.id, r.title)} className="btn-primary !px-4 !py-2 text-xs">Join</button>
            </li>
          ))}
        </ul>
      ) : !open && <p className="p-4 text-sm text-slate">No room is live. Start one for a Q&amp;A, a prayer meeting or a quick catch-up: people listen, and you choose who speaks.</p>}
    </section>
  );
}

type Conn = { pc: RTCPeerConnection; kind: RoomLinkKind; peerAt: string; stream: MediaStream | null };

export function RoomScreen({ id, me, title, onDone }: { id: string; me: string; title?: string; onDone: () => void }) {
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [levels, setLevels] = useState<Record<string, boolean>>({});
  const [muted, setMuted] = useState(false);
  const [note, setNote] = useState("");
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState("");
  const leaveRef = useRef<(m?: string) => void>(() => {});
  const micRef = useRef<MediaStream | null>(null); // for the mute button
  const [chatOpen, setChatOpen] = useState(false); // the chat sheet on phones (always beside the room on a computer)
  const [unread, setUnread] = useState(0);
  const [mode, setMode] = useState<RoomMode>("p2p");
  const [cap, setCap] = useState(0); // how many may listen in this room (from the setting, sent on join)
  // Relay rooms on the live-rooms worker: the chat, the live count and raised hands over one WebSocket (useLiveChannel.ts); off, or
  // while it can't connect, everything below falls back to the room doc and Firestore as before.
  const live = useLiveChannel(id, me, room);
  const liveUpRef = useRef(false); liveUpRef.current = live.status === "live";
  const [edgeHands, setEdgeHands] = useState<Record<string, LiveHand> | null>(null); // the host's beat: hands the worker reported
  useEffect(() => { if (/removed/i.test(live.gone)) leaveRef.current(live.gone); }, [live.gone]);
  // Live mode: the cameras I receive, my own camera (a preview), the camera limits, Audio only, and the host's minutes and prompt.
  const [videos, setVideos] = useState<Record<string, MediaStream>>({});
  const [myCam, setMyCam] = useState<MediaStream | null>(null);
  const [videoCfg, setVideoCfg] = useState<VideoCfg>({ on: false, kbps: 0, fps: 0, height: 0 });
  const [audioOnly, setAudioOnly] = useState(false);
  const audioOnlyRef = useRef(false);
  const [hostLive, setHostLive] = useState<HostLive | null>(null);
  const [prompt, setPrompt] = useState<HostLive["prompt"]>(null);
  const [posterOpen, setPosterOpen] = useState(false);
  const liveRef = useRef<{ startVideo: () => Promise<void>; stopVideo: (tell?: boolean) => Promise<void>; resync: () => void }>({ startVideo: async () => {}, stopVideo: async () => {}, resync: () => {} });
  const tookLive = useCallback((h: HostLive | undefined) => { if (!h) return; setHostLive(h); if (h.prompt) setPrompt(h.prompt); }, []);
  useEffect(() => { const a = readAudioOnly(); audioOnlyRef.current = a; setAudioOnly(a); }, []);

  useEffect(() => {
    let over = false, ice: Ice = [], myAt = "", micOn = false;
    let mic: MediaStream | null = null;
    const conns = new Map<string, Conn>();
    const unsubs: (() => void)[] = [];
    let latest: RoomDoc | null = null;
    // The host's mix for listeners: their own microphone and everyone else on stage, as one stream.
    let ctx: AudioContext | null = null, mixOut: MediaStreamAudioDestinationNode | null = null;
    const mixIn = new Map<string, MediaStreamAudioSourceNode>();
    const meters = new Map<string, AnalyserNode>();
    // Relay rooms: my one connection to Cloudflare, what I send, and what I receive (by the mid Cloudflare gave each track).
    let relayMode = false, rpc: RTCPeerConnection | null = null, fresh = true, pushed: RTCRtpTransceiver | null = null;
    const relayStreams = new Map<string, MediaStream>();
    // Relay rooms: a listener is in the room while their people doc exists (lib/rooms.ts); the stage is in the room doc. Moving on or off
    // stage swaps one for the other, so "gone from both" is only believed after a few seconds.
    let meHere = false, goneTimer: ReturnType<typeof setTimeout> | undefined;
    const inRoomNow = (r: RoomDoc) => !!r.joined?.[me] || meHere;
    const checkGone = () => {
      clearTimeout(goneTimer);
      if (!latest || inRoomNow(latest)) return;
      goneTimer = setTimeout(() => { if (latest && !inRoomNow(latest)) finish("You left the room."); }, 4000);
    };
    const midToUid = new Map<string, string>();
    const pulled = new Map<string, { uid: string; mid: string }>(); // "uid@when they went up" → the track I receive
    // Live mode: the cameras I receive (keyed like pulled), and mine.
    const vpulled = new Map<string, { uid: string; mid: string }>();
    const videoMap = new Map<string, MediaStream>();
    const showVideo = () => setVideos(Object.fromEntries(videoMap));
    let cam: MediaStream | null = null, camTx: RTCRtpTransceiver | null = null, camAt = 0, vcfg: VideoCfg = { on: false, kbps: 0, fps: 0, height: 0 };
    const show = () => setStreams({ ...Object.fromEntries([...conns].filter(([, c]) => c.stream).map(([u, c]) => [u, c.stream!])), ...Object.fromEntries(relayStreams) });
    const audio = () => {
      if (!ctx) { ctx = new AudioContext(); mixOut = ctx.createMediaStreamDestination(); }
      void ctx.resume().catch(() => {});
      return ctx;
    };
    const meter = (uid: string, s: MediaStream) => {
      const a = audio(); const node = a.createAnalyser(); node.fftSize = 256;
      a.createMediaStreamSource(s).connect(node); meters.set(uid, node);
    };
    const mix = (uid: string, s: MediaStream | null) => {
      mixIn.get(uid)?.disconnect(); mixIn.delete(uid);
      if (s && latest && roomRole(latest, me) === "host") { const src = audio().createMediaStreamSource(s); src.connect(mixOut!); mixIn.set(uid, src); }
    };
    const drop = (uid: string) => { const c = conns.get(uid); if (!c) return; c.pc.close(); conns.delete(uid); mix(uid, null); meters.delete(uid); show(); };
    const finish = (message = "") => {
      if (over) return;
      over = true;
      unsubs.forEach((u) => u()); clearInterval(beat); clearInterval(tick); clearInterval(levelTimer); clearTimeout(goneTimer);
      conns.forEach((c) => c.pc.close()); conns.clear();
      rpc?.close(); rpc = null;
      mic?.getTracks().forEach((t) => t.stop());
      cam?.getTracks().forEach((t) => t.stop()); cam = null;
      void ctx?.close().catch(() => {});
      setNote(message || "You left the room.");
      setTimeout(onDone, message ? 1800 : 300);
    };
    const leave = (message = "") => { if (!over) capi("/api/community/rooms", { action: "leave", id }).catch(() => {}); finish(message); };
    leaveRef.current = leave;

    // My microphone, on stage only.
    const ensureMic = async () => {
      if (mic) return mic;
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      micRef.current = mic; setMuted(false);
      meter(me, mic);
      return mic;
    };
    const stopMic = () => { mic?.getTracks().forEach((t) => t.stop()); mic = null; micRef.current = null; meters.delete(me); mixIn.get(me)?.disconnect(); mixIn.delete(me); };

    const wire = (uid: string, kind: RoomLinkKind, peerAt: string, linkId: string, isOffer: boolean) => {
      drop(uid);
      const pc = new RTCPeerConnection({ iceServers: ice });
      const c: Conn = { pc, kind, peerAt, stream: null };
      conns.set(uid, c);
      if (kind === "stage" && mic) mic.getAudioTracks().forEach((t) => pc.addTrack(t, mic!));
      if (kind === "listen" && isOffer && mixOut) mixOut.stream.getAudioTracks().forEach((t) => pc.addTrack(t, mixOut!.stream));
      pc.ontrack = (e) => { c.stream = e.streams[0]; if (kind === "stage") { mix(uid, c.stream); meter(uid, c.stream); } show(); };
      pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") drop(uid); };
      const queued: RTCIceCandidateInit[] = [];
      const addRemote = async (x: RTCIceCandidateInit) => { if (!pc.remoteDescription) queued.push(x); else await pc.addIceCandidate(x).catch(() => {}); };
      const flush = async () => { while (queued.length && pc.remoteDescription) await pc.addIceCandidate(queued.shift()!).catch(() => {}); };
      const sub = (side: "fromCandidates" | "toCandidates") => collection(db, "communityRooms", id, "links", linkId, side);
      pc.onicecandidate = (e) => { if (e.candidate) addDoc(sub(isOffer ? "fromCandidates" : "toCandidates"), e.candidate.toJSON()).catch(() => {}); };
      unsubs.push(onSnapshot(sub(isOffer ? "toCandidates" : "fromCandidates"), (s) => s.docChanges().forEach((ch) => { if (ch.type === "added") void addRemote(ch.doc.data() as RTCIceCandidateInit); }), () => {}));
      return { pc, flush };
    };
    const offerTo = async (uid: string, kind: RoomLinkKind, peerAt: string) => {
      if (kind === "stage") await ensureMic();
      const placeholder = doc(collection(db, "communityRooms", id, "links"));
      const { pc, flush } = wire(uid, kind, peerAt, placeholder.id, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await setDoc(placeholder, { from: me, to: uid, at: new Date().toISOString(), kind, offer: { type: offer.type, sdp: offer.sdp ?? "" } } satisfies RoomLink);
      unsubs.push(onSnapshot(placeholder, async (s) => {
        const l = s.data() as RoomLink | undefined;
        if (l?.answer && !pc.remoteDescription) { await pc.setRemoteDescription(l.answer as RTCSessionDescriptionInit).catch(() => drop(uid)); await flush(); }
      }, () => {}));
    };
    const answer = async (linkId: string, l: RoomLink, peerAt: string) => {
      if (l.kind === "stage") await ensureMic();
      const { pc, flush } = wire(l.from, l.kind, peerAt, linkId, false);
      await pc.setRemoteDescription(l.offer as RTCSessionDescriptionInit);
      await flush();
      const a = await pc.createAnswer();
      await pc.setLocalDescription(a);
      await updateDoc(doc(db, "communityRooms", id, "links", linkId), { answer: { type: a.type, sdp: a.sdp ?? "" } });
    };

    // ── The relay ──
    // Steps with Cloudflare one at a time (each SDP exchange must finish before the next), through our server.
    let queue: Promise<unknown> = Promise.resolve();
    const serial = <T,>(fn: () => Promise<T>): Promise<T> => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };
    const relay = async (body: Record<string, unknown>): Promise<RelayRes> => {
      const r = await capi<RelayRes>("/api/community/rooms", { action: "relay", id, ...body, ...(fresh ? { fresh: true } : {}) });
      fresh = false; // the server opened my session: later steps use it
      return r;
    };
    const relayPc = () => {
      if (rpc) return rpc;
      const pc = new RTCPeerConnection({ iceServers: ice, bundlePolicy: "max-bundle" });
      pc.ontrack = (e) => {
        const uid = e.transceiver?.mid ? midToUid.get(e.transceiver.mid) : undefined;
        if (!uid) return;
        const st = new MediaStream([e.track]);
        if (e.track.kind === "video") { videoMap.set(uid, st); showVideo(); return; }
        relayStreams.set(uid, st); meters.delete(uid); meter(uid, st); show();
      };
      pc.onconnectionstatechange = () => { if (pc.connectionState === "failed" && !over) setNote("Lost the connection to the room's relay. Leave and join again."); };
      rpc = pc;
      return pc;
    };
    // On stage: my microphone goes up once.
    const startPush = () => serial(async () => {
      const track = mic?.getAudioTracks()[0];
      if (pushed || !track || over) return;
      const pc = relayPc();
      const tx = pc.addTransceiver(track, { direction: "sendonly" });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      try {
        const r = await relay({ op: "push", offer: { type: offer.type, sdp: offer.sdp ?? "" }, mid: tx.mid });
        if (r.answer) await pc.setRemoteDescription(r.answer);
        pushed = tx;
      } catch (e) {
        await tx.sender.replaceTrack(null).catch(() => {});
        throw e;
      }
    });
    // Off stage: stop sending (the server cuts it at Cloudflare too).
    const stopPush = () => serial(async () => {
      if (!pushed) return;
      await pushed.sender.replaceTrack(null).catch(() => {});
      pushed = null;
      if (!over) await relay({ op: "unpush" }).catch(() => {});
    });
    // Receive the other stage microphones that are up (lib/rooms.ts pullsFor); let go of the ones that aren't.
    const relaySync = (r: RoomDoc) => serial(async () => {
      if (over) return;
      const want = pullsFor(r, me);
      const keys = new Set(want.map((w) => w.key));
      const gone = [...pulled].filter(([k]) => !keys.has(k));
      for (const [k, v] of gone) { pulled.delete(k); midToUid.delete(v.mid); relayStreams.delete(v.uid); meters.delete(v.uid); }
      if (gone.length) { show(); await relay({ op: "close", mids: gone.map(([, v]) => v.mid) }).catch(() => {}); }
      const add = want.filter((w) => !pulled.has(w.key));
      if (!add.length) return;
      const res = await relay({ op: "pull", uids: add.map((a) => a.uid) }).catch(() => null); // someone just stepped down: tried again on the next change
      if (!res?.tracks?.length) return;
      for (const t of res.tracks) { const w = add.find((a) => a.uid === t.uid); if (w) { pulled.set(w.key, t); midToUid.set(t.mid, t.uid); } }
      await takeOffer(res);
    }).catch(() => {});
    // Cloudflare's offer after a pull: answered on the same connection.
    const takeOffer = async (res: RelayRes) => {
      const pc = relayPc();
      if (!res.offer) return;
      await pc.setRemoteDescription(res.offer);
      const a = await pc.createAnswer();
      await pc.setLocalDescription(a);
      if (res.renegotiate) await relay({ op: "answer", answer: { type: a.type, sdp: a.sdp ?? "" } });
    };
    // Live mode: the cameras up on stage (none on Audio only, lib/rooms-live.ts videoPullsFor); the same steps as the microphones.
    const videoSync = (r: RoomDoc) => serial(async () => {
      if (over) return;
      const want = videoPullsFor(r, me, audioOnlyRef.current);
      const keys = new Set(want.map((w) => w.key));
      const gone = [...vpulled].filter(([k]) => !keys.has(k));
      for (const [k, v] of gone) { vpulled.delete(k); midToUid.delete(v.mid); videoMap.delete(v.uid); }
      if (gone.length) { showVideo(); await relay({ op: "close", mids: gone.map(([, v]) => v.mid) }).catch(() => {}); }
      const add = want.filter((w) => !vpulled.has(w.key));
      if (!add.length) return;
      relayPc();
      const res = await relay({ op: "pull", uids: add.map((a) => a.uid), video: true }).catch(() => null);
      if (!res?.tracks?.length) return;
      for (const t of res.tracks) { const w = add.find((a) => a.uid === t.uid); if (w) { vpulled.set(w.key, t); midToUid.set(t.mid, t.uid); } }
      await takeOffer(res);
    }).catch(() => {});
    // My camera: a second track on the same connection, capped by the settings; off again without reconnecting.
    const startVideo = () => serial(async () => {
      if (camTx || over || !relayMode) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints({ videoHeight: vcfg.height, videoFps: vcfg.fps }) });
      const pc = relayPc();
      const tx = pc.addTransceiver(stream.getVideoTracks()[0], { direction: "sendonly", streams: [stream], sendEncodings: [videoEncoding({ videoKbps: vcfg.kbps, videoFps: vcfg.fps })] });
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const r = await relay({ op: "video", offer: { type: offer.type, sdp: offer.sdp ?? "" }, mid: tx.mid });
        if (r.answer) await pc.setRemoteDescription(r.answer);
        cam = stream; camTx = tx; camAt = Date.now(); setMyCam(stream); tookLive(r.host);
      } catch (e) {
        await tx.sender.replaceTrack(null).catch(() => {});
        stream.getTracks().forEach((t) => t.stop());
        throw e;
      }
    });
    // tell: false when the server already took it down (the budget, or off the stage).
    const stopVideo = (tell = true) => serial(async () => {
      if (!camTx) return;
      await camTx.sender.replaceTrack(null).catch(() => {});
      camTx = null; cam?.getTracks().forEach((t) => t.stop()); cam = null; setMyCam(null);
      if (tell && !over) tookLive((await relay({ op: "unvideo" }).catch(() => null as RelayRes | null))?.host);
    });
    liveRef.current = { startVideo, stopVideo, resync: () => { if (latest && relayMode) void videoSync(latest); } };
    const relayReconcile = async (r: RoomDoc) => {
      // A recorded room: a speaker's microphone waits for their one-tap agreement (the server refuses it until then too).
      const onStage = roomRole(r, me) !== "listener" && recordingPrompt(r, me) !== "consent";
      if (onStage && !micOn) {
        micOn = true;
        try { await ensureMic(); await startPush(); }
        catch (e) { setNote(e instanceof Error && !/Permission|NotAllowed/i.test(e.name + e.message) ? e.message : "Allow the microphone to speak."); }
      }
      if (!onStage && micOn) { micOn = false; await stopPush(); stopMic(); }
      // My camera taken down by the server (the budget ran out, the host turned speakers' video off, or I left the stage).
      if (camTx && Date.now() - camAt > 5000 && !r.videoOn?.[me]) void stopVideo(false);
      void relaySync(r);
      void videoSync(r);
    };

    // The connections I should have now (lib/rooms.ts linksFor): wrong ones are closed, missing ones I start are offered; the ones the
    // other side starts arrive as links to me (below).
    const reconcile = async (r: RoomDoc) => {
      const want = linksFor(r, me);
      const onStage = roomRole(r, me) !== "listener";
      if (onStage && !micOn) { micOn = true; await ensureMic().catch(() => { setNote("Allow the microphone to speak."); }); if (roomRole(r, me) === "host") { audio(); if (mic) { const src = audio().createMediaStreamSource(mic); src.connect(mixOut!); mixIn.set(me, src); } } }
      if (!onStage && micOn) { micOn = false; stopMic(); }
      for (const [u, c] of conns) {
        const w = want.find((x) => x.peer === u);
        if (!w || w.kind !== c.kind || (r.joined[u]?.at ?? "") !== c.peerAt) drop(u);
      }
      for (const w of want) if (w.offer && !conns.has(w.peer)) void offerTo(w.peer, w.kind, r.joined[w.peer]?.at ?? "").catch(() => drop(w.peer));
    };

    let beat: ReturnType<typeof setInterval> | undefined, tick: ReturnType<typeof setInterval> | undefined, levelTimer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        const r = await capi<{ iceServers: Ice; mode?: RoomMode; cap?: number; video?: VideoCfg }>("/api/community/rooms", { action: "join", id });
        ice = r.iceServers;
        if (r.video) { vcfg = r.video; setVideoCfg(r.video); }
        relayMode = r.mode === "relay"; setMode(relayMode ? "relay" : "p2p"); setCap(r.cap ?? 0);
      } catch (e) { finish(e instanceof Error ? e.message : "Couldn't join the room."); return; }
      if (over) return;
      let first = true;
      if (relayMode) unsubs.push(onSnapshot(doc(db, "communityRooms", id, "people", me), (s) => { meHere = s.exists(); checkGone(); }, () => {}));
      unsubs.push(onSnapshot(doc(db, "communityRooms", id), (s) => {
        const r = s.data() as RoomDoc | undefined;
        if (!r || r.status !== "live") { finish("The room has ended."); return; }
        if (!relayMode && !r.joined?.[me]) { if (!first) finish("You left the room."); return; }
        latest = r; setRoom(r);
        if (relayMode) checkGone();
        if (first) {
          first = false; myAt = r.joined[me]?.at ?? new Date().toISOString();
          const t0 = Date.parse(r.createdAt); tick = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000);
          if (!relayMode) unsubs.push(onSnapshot(query(collection(db, "communityRooms", id, "links"), where("to", "==", me)), (snap) => snap.docChanges().forEach((ch) => {
            const l = ch.doc.data() as RoomLink;
            if (ch.type !== "added" || !l.offer || l.answer || Date.parse(l.at) < Date.parse(myAt) - 30_000 || !latest) return;
            const w = linksFor(latest, me).find((x) => x.peer === l.from && x.kind === l.kind && !x.offer);
            if (w) void answer(ch.doc.id, l, latest.joined[l.from]?.at ?? "").catch(() => drop(l.from));
          }), () => {}));
        }
        void (relayMode ? relayReconcile(r) : reconcile(r));
      }, () => finish("The room has ended.")));
      beat = setInterval(() => {
        // A listener connected to the live-rooms worker doesn't heartbeat: the worker says they're here (and tells them when it ends).
        const skip = liveUpRef.current && !!latest && roomRole(latest, me) === "listener";
        if (!skip) capi<{ live: boolean; host?: HostLive; hands?: Record<string, LiveHand> }>("/api/community/rooms", { action: "beat", id }).then((x) => { if (!x.live) finish("The room has ended."); tookLive(x.host); setEdgeHands(x.hands ?? null); }).catch(() => {});
        if (relayMode && latest) { void relaySync(latest); void videoSync(latest); } // picks up a pull that failed in a race
      }, ROOM_BEAT_MS);
      // Who is talking: a ring round their picture while their sound is above a whisper.
      const buf = new Uint8Array(128);
      levelTimer = setInterval(() => {
        const next: Record<string, boolean> = {};
        meters.forEach((a, u) => { a.getByteTimeDomainData(buf); let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128)); next[u] = peak > 10; });
        setLevels(next);
      }, 250);
    })();
    return () => { if (!over) leave(); };
    // One room per screen: everything is set up once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (body: Record<string, unknown>, tag = "") => { setBusy(tag); try { await capi("/api/community/rooms", { id, ...body }); } catch (e) { setNote(e instanceof Error ? e.message : "Couldn't do that."); setTimeout(() => setNote(""), 2500); } finally { setBusy(""); } };
  const role = room ? roomRole(room, me) : "listener";
  const stage = room ? stageOf(room) : [];
  const relayRoom = room?.mode === "relay";
  const listeners = room && !relayRoom ? listenersOf(room) : []; // phone to phone: the list; on the relay, the count and "People here"
  const listening = live.count ?? (room ? listenerCount(room) : 0);
  const full = cap > 0 && listening >= cap;
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [camBusy, setCamBusy] = useState(false);
  // The budget ran out: my camera goes down when the grace ends (the server takes it down then too).
  const graceUntil = hostLive?.graceUntil ?? null;
  useEffect(() => {
    if (!graceUntil || !myCam) return;
    const t = setTimeout(() => void liveRef.current.stopVideo().catch(() => {}), Math.max(0, Date.parse(graceUntil) - Date.now()));
    return () => clearTimeout(t);
  }, [graceUntil, myCam]);
  // Hands: over the socket; while it's down, the ones the worker reported (on the host's beat) with any raised through the server.
  const liveHands = live.hands ?? (edgeHands ? { ...edgeHands, ...Object.fromEntries(Object.entries(room?.handInfo ?? {}).filter(([u]) => room?.hands?.[u]).map(([u, h]) => [u, { ...h, at: room!.hands[u] }])) } : null);
  const who = (u: string) => room?.joined[u] ?? liveHands?.[u] ?? room?.handInfo?.[u];
  const hands = liveHands ? Object.entries(liveHands).filter(([u]) => !stage.includes(u)).map(([u, h]) => [u, h.at] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]))
    : room ? Object.entries(room.hands ?? {}).filter(([u]) => (relayRoom ? !stage.includes(u) && !!room.handInfo?.[u] : listeners.includes(u))).sort((a, b) => a[1].localeCompare(b[1])) : [];
  const handUp = live.hands ? !!live.hands[me] : !!room?.hands?.[me];
  const toggleMute = () => { const m = !muted; micRef.current?.getAudioTracks().forEach((t) => { t.enabled = !m; }); setMuted(m); };
  // Live mode.
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(""), 3000); };
  const mayVideo = !!room && relayRoom && videoCfg.on && canVideo(room, me, { videoOn: 1 });
  const videoUp = !!room && anyVideo(room);
  const toggleVideo = async () => {
    setCamBusy(true);
    try { if (myCam) await liveRef.current.stopVideo(); else await liveRef.current.startVideo(); }
    catch (e) { flash(e instanceof Error && /Permission|NotAllowed/i.test(e.name + e.message) ? "Allow the camera to turn video on." : e instanceof Error ? e.message : "Couldn't turn video on."); }
    finally { setCamBusy(false); }
  };
  // Every camera down: mine, and the speakers' (by taking back their permission to use video).
  const backToAudio = async () => {
    if (myCam) await liveRef.current.stopVideo().catch(() => {});
    if (room?.stageVideo && room.speakers.some((u) => room.videoOn?.[u])) await act({ action: "stagevideo", on: false });
  };
  const toggleAudioOnly = () => {
    const a = !audioOnly; audioOnlyRef.current = a; setAudioOnly(a);
    try { localStorage.setItem(AUDIO_ONLY_KEY, a ? "1" : "0"); } catch { /* remembered for this visit only */ }
    liveRef.current.resync();
  };

  return (
    <div className="fixed inset-0 z-[130] flex bg-ink text-white" role="dialog" aria-modal="true" aria-label={`Audio room: ${room?.title ?? title ?? ""}`}
      style={{ backgroundImage: "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(122,3,40,0.55) 0%, rgba(26,18,16,0) 70%)" }}>
      <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-start justify-between gap-3 px-5 pt-[calc(env(safe-area-inset-top)_+_1rem)]">
        <div className="min-w-0">
          <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.25em] text-white/55">{room?.communityName ?? "Audio room"} · <span className="text-[#FF6B6B]">● Live</span> {room ? duration(secs) : ""}</p>
          <h1 className="mt-1 font-display text-2xl leading-tight sm:text-3xl">{room?.title ?? title ?? "Joining…"}</h1>
          <p className="mt-1 text-xs text-white/50" aria-live="polite">{note || (room ? `${stage.length} on stage · ${listening.toLocaleString("en-GB")}${cap ? ` of ${cap.toLocaleString("en-GB")}` : ""} listening${full ? " (full)" : ""} · ${mode === "relay" ? "through the relay" : "phone to phone"}${room && isRecorded(room) ? "" : ", nothing recorded"}` : "Connecting…")}</p>
          {room && isRecorded(room) && <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#E5383B]/20 px-3 py-1 text-xs font-semibold text-[#FFB4A2]" role="status"><span aria-hidden>●</span>{RECORDING_NOTICE}. <a href={RECORDING_HELP} target="_blank" rel="noreferrer" className="underline">What this means</a></p>}
          {role === "host" && room?.recording?.status === "failed" && <p className="mt-1 text-xs text-[#FFB4A2]" role="status">{room.recording.why}</p>}
          {role === "host" && room?.note && <p className="mt-1 text-xs text-[#FFB4A2]" role="status">{room.note}</p>}
          {role === "host" && relayRoom && videoCfg.on && hostLive && <p className="mt-1 text-xs text-white/60">🎥 {hostLive.staffPass ? "Staff test pass: video minutes aren't counted" : minutesLeftText(hostLive.minutesLeft)}</p>}
          {role !== "host" && room?.hostBooks && room.hostUsername && <a href={`/u/${room.hostUsername}#book`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block rounded-full bg-white px-3 py-1.5 font-ui text-xs font-bold text-ink">📅 Book a session with {room.hostName}</a>}
        </div>
        <button type="button" onClick={() => leaveRef.current()} className="shrink-0 rounded-full bg-white/10 px-4 py-2 font-ui text-xs font-semibold hover:bg-white/20">Leave quietly</button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-6">
        {role === "host" && prompt && !(prompt.kind === "drop" && myCam) && !(prompt.kind !== "drop" && !videoUp) && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-[#FFB4A2]/15 p-3" role="status">
            <p className="min-w-0 flex-1 text-sm">{prompt.text}</p>
            {prompt.kind === "drop" && <button type="button" disabled={camBusy} onClick={() => { setPrompt(null); void toggleVideo(); }} className="rounded-full bg-white px-3 py-1.5 font-ui text-xs font-bold text-ink">Turn video on</button>}
            {prompt.kind !== "drop" && <button type="button" disabled={camBusy} onClick={() => { setPrompt(null); void backToAudio(); }} className="rounded-full bg-white px-3 py-1.5 font-ui text-xs font-bold text-ink">{prompt.kind === "budget" ? "Turn video off now" : "Back to audio"}</button>}
            {prompt.kind !== "budget" && <button type="button" onClick={() => setPrompt(null)} className="text-xs text-white/60 underline">{prompt.kind === "drop" ? "Not now" : "Keep video"}</button>}
          </div>
        )}
        {room && (relayRoom || room.poster) && (
          <LiveScreen videos={videos} myCam={myCam} poster={room.poster ?? ""} audioOnly={audioOnly} videoUp={videoUp} nameOf={(u) => (u === me ? "You" : room.joined[u]?.name ?? "")} />
        )}
        {role === "host" && (
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
            <button type="button" onClick={() => setPosterOpen((v) => !v)} className="rounded-full bg-white/10 px-3 py-1.5 font-ui font-semibold hover:bg-white/20">🖼 Poster</button>
            {relayRoom && videoCfg.on && (
              <label className="flex items-center gap-2 text-white/70"><input type="checkbox" checked={room?.stageVideo === true} onChange={(e) => act({ action: "stagevideo", on: e.target.checked })} className="h-4 w-4" />Speakers can turn video on</label>
            )}
            {posterOpen && <div className="w-full"><PosterChoice value={{ source: "none" }} onError={flash} onChange={(p) => { setPosterOpen(false); void act({ action: "poster", source: p.source, url: p.url }); }} /></div>}
          </div>
        )}
        <p className="font-ui text-xs font-semibold uppercase tracking-[0.2em] text-white/45">On stage</p>
        <ul className="mt-3 grid grid-cols-3 gap-4 sm:grid-cols-5">
          {stage.map((u) => (
            <Person key={u} name={u === me ? "You" : room!.joined[u]?.name ?? "Someone"} avatar={room!.joined[u]?.avatar ?? ""} big talking={!!levels[u]} badge={u === room!.hostUid ? "Host" : "Speaker"}
              action={role === "host" && u !== me ? { label: "Move to listeners", run: () => act({ action: "speaker", uid: u, on: false }, u) } : undefined} busy={busy === u} />
          ))}
        </ul>
        {role === "host" && hands.length > 0 && (
          <div className="mt-8 rounded-2xl bg-white/[0.06] p-4">
            <p className="font-ui text-sm font-bold">✋ Raised hands</p>
            <ul className="mt-3 space-y-2">
              {hands.map(([u]) => (
                <li key={u} className="flex items-center gap-3">
                  <Avatar src={who(u)?.avatar ?? ""} alt="" size={36} className="!h-9 !w-9 rounded-full" />
                  <span className="min-w-0 flex-1 truncate text-sm">{who(u)?.name}</span>
                  <button type="button" disabled={busy === u || room!.speakers.length >= ROOM_SPEAKERS_MAX} onClick={() => act({ action: "speaker", uid: u, on: true }, u)} className="rounded-full bg-white px-3 py-1.5 font-ui text-xs font-bold text-ink disabled:opacity-40">Bring up</button>
                </li>
              ))}
            </ul>
            {room!.speakers.length >= ROOM_SPEAKERS_MAX && <p className="mt-2 text-xs text-white/55">The stage is full ({ROOM_SPEAKERS_MAX} speakers besides you). Move someone to listeners first.</p>}
          </div>
        )}
        <p className="mt-8 font-ui text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Listening · {listening.toLocaleString("en-GB")}{cap ? ` of ${cap.toLocaleString("en-GB")}` : ""}{full ? " · the room is full" : ""}</p>
        {relayRoom && (
          peopleOpen
            ? <RoomPeople id={id} me={me} canInvite={role === "host"} busy={busy} invite={(u) => act({ action: "speaker", uid: u, on: true }, u)} onClose={() => setPeopleOpen(false)} />
            : <button type="button" onClick={() => setPeopleOpen(true)} className="mt-3 rounded-full bg-white/10 px-4 py-2 font-ui text-xs font-semibold hover:bg-white/20">People here</button>
        )}
        <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {listeners.map((u) => (
            <Person key={u} name={u === me ? "You" : room!.joined[u]?.name ?? "Someone"} avatar={room!.joined[u]?.avatar ?? ""} hand={!!room!.hands?.[u]}
              action={role === "host" ? { label: "Invite to speak", run: () => act({ action: "speaker", uid: u, on: true }, u) } : undefined} busy={busy === u} />
          ))}
        </ul>
      </div>

      {Object.entries(streams).map(([u, s]) => <RemoteAudio key={u} stream={s} />)}

      {room && recordingPrompt(room, me) === "consent" && (
        <div className="mx-5 mb-3 rounded-2xl bg-white/[0.08] p-4" role="alertdialog" aria-label={RECORDING_NOTICE}>
          <p className="font-ui text-sm font-bold">{RECORDING_NOTICE}</p>
          <p className="mt-1 text-xs text-white/70">You&apos;re on stage. If you speak, your voice is in the recording, which the host may publish as a replay. <a href={RECORDING_HELP} target="_blank" rel="noreferrer" className="underline">More</a></p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy === "consent"} onClick={() => act({ action: "consent" }, "consent")} className="rounded-full bg-white px-4 py-2 font-ui text-xs font-bold text-ink">I agree, turn my mic on</button>
            <button type="button" onClick={() => act({ action: "speaker", uid: me, on: false })} className="rounded-full bg-white/10 px-4 py-2 font-ui text-xs hover:bg-white/20">Back to listening</button>
          </div>
        </div>
      )}

      <footer className="flex items-center justify-center gap-4 border-t border-white/10 px-5 pb-[calc(env(safe-area-inset-bottom)_+_1rem)] pt-4">
        {role === "listener" ? (
          <button type="button" onClick={() => { if (!live.raise(!handUp)) void act({ action: "hand", up: !handUp }); }} className={`rounded-full px-5 py-3 font-ui text-sm font-bold ${handUp ? "bg-white text-ink" : "bg-white/10 hover:bg-white/20"}`}>{handUp ? "✋ Hand raised · lower it" : "✋ Raise hand to speak"}</button>
        ) : (
          <>
            <MuteButton muted={muted} onToggle={toggleMute} />
            {mayVideo && <button type="button" disabled={camBusy} onClick={() => void toggleVideo()} aria-pressed={!!myCam} className={`rounded-full px-4 py-3 font-ui text-sm font-semibold ${myCam ? "bg-white text-ink" : "bg-white/10 hover:bg-white/20"} disabled:opacity-40`}>{myCam ? "🎥 Video off" : "🎥 Video"}</button>}
            {role === "speaker" && <button type="button" onClick={() => act({ action: "speaker", uid: me, on: false })} className="rounded-full bg-white/10 px-4 py-3 font-ui text-sm hover:bg-white/20">Back to listening</button>}
          </>
        )}
        {relayRoom && !myCam && <button type="button" onClick={toggleAudioOnly} aria-pressed={audioOnly} title="Data saver: don't download video" className={`rounded-full px-4 py-3 font-ui text-sm ${audioOnly ? "bg-white text-ink" : "bg-white/10 hover:bg-white/20"}`}>{audioOnly ? "🔈 Audio only" : "📺 Video when on"}</button>}
        <button type="button" onClick={() => { setChatOpen(true); setUnread(0); }} aria-label={`Chat${unread ? `, ${unread} new` : ""}`} className="relative flex h-12 items-center gap-2 rounded-full bg-white/10 px-4 font-ui text-sm font-semibold hover:bg-white/20 lg:hidden">
          💬 Chat{unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E5383B] px-1 text-[10px] font-bold">{unread}</span>}
        </button>
        {role === "host" && <button type="button" onClick={() => confirm("End the room for everyone?") && act({ action: "end" })} className="rounded-full bg-[#E5383B] px-5 py-3 font-ui text-sm font-bold hover:bg-[#D12F32]">End room</button>}
      </footer>
      </div>
      {room && (
        <aside className={`${chatOpen ? "fixed inset-x-0 bottom-0 z-10 flex h-[75vh] rounded-t-3xl shadow-2xl" : "hidden"} flex-col border-white/10 bg-[#211816] lg:static lg:flex lg:h-auto lg:w-96 lg:rounded-none lg:border-l lg:shadow-none`} aria-label="Room chat">
          <RoomChatPanel id={id} me={me} room={room} relay={relayRoom} live={live} canRemove={role === "host" || !!live.you?.mod} open={chatOpen} onClose={() => setChatOpen(false)} onNew={() => { if (!chatOpen) setUnread((n) => n + 1); }} remove={(mid) => act({ action: "unchat", messageId: mid })} />
        </aside>
      )}
    </div>
  );
}

// The room's chat (lib/rooms.ts): everyone in the room types here while it's on; host and speakers are marked. The newest stays in view.
// On the live-rooms worker (live.on) the messages come over the room's WebSocket instead of a live read of the chat collection.
function RoomChatPanel({ id, me, room, relay, live, canRemove, open, onClose, onNew, remove }: { id: string; me: string; room: RoomDoc; relay: boolean; live: LiveChannel; canRemove: boolean; open: boolean; onClose: () => void; onNew: () => void; remove: (messageId: string) => void }) {
  const [fsMsgs, setMsgs] = useState<(RoomChat & { id: string })[]>([]);
  const msgs = live.on ? live.msgs : fsMsgs;
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null); // others' messages already counted (null until the first load, which isn't "new")
  const onNewRef = useRef(onNew); onNewRef.current = onNew;
  const countNew = useCallback((list: { id: string; from: string }[]) => {
    if (!seen.current && !list.length) return; // still loading: the first messages aren't "new"
    const theirs = list.filter((m) => m.from !== me).map((m) => m.id);
    if (seen.current) for (const mid of theirs) if (!seen.current.has(mid)) onNewRef.current();
    seen.current = new Set([...(seen.current ?? []), ...theirs]);
  }, [me]);
  useEffect(() => { if (live.on) countNew(live.msgs); }, [live.on, live.msgs, countNew]);
  useEffect(() => (live.on ? undefined : onSnapshot(query(collection(db, "communityRooms", id, "chat"), orderBy("at"), limitToLast(100)), (s) => {
    const list = s.docs.map((d) => ({ ...(d.data() as RoomChat), id: d.id }));
    countNew(list);
    setMsgs(list);
  }, () => {})), [id, live.on, countNew]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length, open]);
  const mine = room.joined[me];
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || (!mine && !relay)) return;
    setText(""); setErr("");
    // On the live-rooms worker, over the socket (slow mode and limits are held there); through the server while it's reconnecting.
    if (live.send(t.slice(0, ROOM_CHAT_MAX))) return;
    // Relay rooms: through the server, which holds slow mode in big rooms (lib/rooms-server.ts sendRoomChat).
    if (relay) { try { await capi("/api/community/rooms", { action: "chat", id, text: t.slice(0, ROOM_CHAT_MAX) }); } catch (x) { setErr(x instanceof Error ? x.message : "Couldn't send. Try again."); setText(t); } return; }
    if (!mine) return;
    try { await addDoc(collection(db, "communityRooms", id, "chat"), { from: me, name: mine.name, avatar: mine.avatar, text: t.slice(0, ROOM_CHAT_MAX), at: new Date().toISOString() } satisfies RoomChat); }
    catch { setErr("Couldn't send. Try again."); setText(t); }
  }
  const badge = (u: string) => (u === room.hostUid ? "Host" : room.speakers.includes(u) ? "Speaker" : "");
  return (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="font-ui text-sm font-bold">Room chat</p>
        <button type="button" onClick={onClose} className="rounded-full px-2 text-xl text-white/60 hover:text-white lg:hidden" aria-label="Close the chat">×</button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {!msgs.length && <p className="pt-6 text-center text-sm text-white/45">Say hello, ask a question, or send an amen. Everyone in the room sees it while the room is on.</p>}
        {msgs.map((m) => (
          <div key={m.id} className="group flex gap-2.5">
            <Avatar src={m.avatar} alt="" size={30} className="!h-[30px] !w-[30px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="font-ui text-xs"><span className="font-bold text-white/90">{m.from === me ? "You" : m.name}</span>{badge(m.from) && <span className="ml-1.5 rounded bg-white/10 px-1.5 py-px text-[10px] uppercase tracking-wide text-white/60">{badge(m.from)}</span>}<span className="ml-1.5 text-white/35">{ago(m.at)}</span></p>
              <p className="whitespace-pre-line break-words text-sm text-white/85">{m.text}</p>
            </div>
            {canRemove && m.from !== me && (
              <span className="flex flex-col items-end gap-0.5 self-start opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                <button type="button" onClick={() => { if (!live.remove(m.id)) remove(m.id); }} className="text-[11px] text-white/40 hover:text-white">Remove</button>
                {live.status === "live" && m.from !== room.hostUid && (live.mutedList.includes(m.from)
                  ? <button type="button" onClick={() => live.mute(m.from, false)} className="text-[11px] text-white/40 hover:text-white">Unmute</button>
                  : <button type="button" onClick={() => live.mute(m.from, true)} className="text-[11px] text-white/40 hover:text-white">Mute</button>)}
                {live.status === "live" && m.from !== room.hostUid && <button type="button" onClick={() => confirm(`Remove ${m.name} from this room?`) && live.ban(m.from)} className="text-[11px] text-white/40 hover:text-white">Remove from room</button>}
              </span>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t border-white/10 p-3 pb-[calc(env(safe-area-inset-bottom)_+_0.75rem)]">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={ROOM_CHAT_MAX} placeholder="Drop a note in the room…" aria-label="Drop a note in the room" className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:bg-white/15 focus:outline-none" />
        <button className="rounded-full bg-white px-4 py-2.5 font-ui text-sm font-bold text-ink disabled:opacity-40" disabled={!text.trim()}>Send</button>
      </form>
      {relay && (live.status === "live" ? live.slow : room.chatSlow ?? 0) > 0 && room.hostUid !== me && !room.speakers.includes(me) && <p className="px-4 pb-2 text-xs text-white/45">Slow mode: one message every {live.status === "live" ? live.slow : room.chatSlow} seconds each.</p>}
      {live.status === "live" && room.hostUid === me && (
        <p className="flex items-center gap-2 px-4 pb-2 text-xs text-white/55">Slow mode{live.hostSlow === null ? ` (automatic${live.slow ? ": on" : ": off"})` : live.hostSlow ? ": on" : ": off"}
          <button type="button" onClick={() => live.setSlow(live.hostSlow === true ? false : live.hostSlow === false ? null : true)} className="rounded-full bg-white/10 px-2 py-0.5 font-semibold hover:bg-white/20">{live.hostSlow === true ? "Turn off" : live.hostSlow === false ? "Automatic" : "Turn on"}</button>
        </p>
      )}
      {live.you?.muted && <p className="px-4 pb-2 text-xs text-white/45">The host has muted you in this chat.</p>}
      {canRemove && live.status === "live" && live.mutedList.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 px-4 pb-2 text-xs text-white/55">Muted in the chat:
          {live.mutedList.map((u) => <button key={u} type="button" onClick={() => live.mute(u, false)} className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20" aria-label={`Unmute ${msgs.find((x) => x.from === u)?.name ?? "them"}`}>{msgs.find((x) => x.from === u)?.name ?? "Someone"} · Unmute</button>)}
        </p>
      )}
      {live.status === "fallback" && <p className="px-4 pb-2 text-xs text-white/45">Reconnecting the live chat… new messages show every few seconds meanwhile.</p>}
      {(err || live.err) && <p className="px-4 pb-2 text-xs text-[#FF6B6B]" role="alert">{err || live.err}</p>}
    </>
  );
}

// Relay rooms: who is listening, a page at a time from the server (a big room's listeners aren't on the room doc). The host can invite
// anyone here to speak.
function RoomPeople({ id, me, canInvite, busy, invite, onClose }: { id: string; me: string; canInvite: boolean; busy: string; invite: (uid: string) => void; onClose: () => void }) {
  const [people, setPeople] = useState<{ uid: string; name: string; avatar: string; hand: boolean }[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (after: string | null) => {
    setLoading(true);
    try {
      const r = await capi<{ people: typeof people; next: string | null }>("/api/community/rooms", { action: "people", id, after });
      setPeople((p) => (after ? [...p, ...r.people] : r.people)); setNext(r.next);
    } catch { /* the count above still shows */ } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(null); }, [load]);
  return (
    <div className="mt-3 rounded-2xl bg-white/[0.06] p-4">
      <div className="flex items-center justify-between"><p className="font-ui text-sm font-bold">People here</p><button type="button" onClick={onClose} className="text-xs text-white/60 underline">Hide</button></div>
      <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
        {people.map((p) => (
          <Person key={p.uid} name={p.uid === me ? "You" : p.name} avatar={p.avatar} hand={p.hand}
            action={canInvite && p.uid !== me ? { label: "Invite to speak", run: () => invite(p.uid) } : undefined} busy={busy === p.uid} />
        ))}
      </ul>
      {next && <button type="button" disabled={loading} onClick={() => load(next)} className="mt-3 rounded-full bg-white/10 px-4 py-2 font-ui text-xs font-semibold hover:bg-white/20 disabled:opacity-40">More</button>}
      {!loading && !people.length && <p className="text-xs text-white/50">Nobody is listening yet.</p>}
    </div>
  );
}

// Mute switches the microphone's track off (on stage only); listeners have no microphone at all.
function MuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"} className={`flex h-14 w-14 items-center justify-center rounded-full text-xl ${muted ? "bg-white text-ink" : "bg-white/[0.12] hover:bg-white/20"}`}><MicIcon off={muted} /></button>;
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  return <audio ref={ref} autoPlay className="hidden" />;
}

function Person({ name, avatar, big, talking, badge, hand, action, busy }: { name: string; avatar: string; big?: boolean; talking?: boolean; badge?: string; hand?: boolean; action?: { label: string; run: () => void }; busy?: boolean }) {
  const [menu, setMenu] = useState(false);
  return (
    <li className="relative flex flex-col items-center text-center">
      <button type="button" disabled={!action} onClick={() => setMenu((v) => !v)} className={`relative rounded-full transition ${talking ? "ring-4 ring-[#4ADE80] ring-offset-2 ring-offset-ink" : "ring-2 ring-white/10"}`}>
        <Avatar src={avatar} alt="" size={big ? 72 : 48} className={`${big ? "!h-16 !w-16 sm:!h-20 sm:!w-20" : "!h-12 !w-12"} rounded-full`} />
        {hand && <span className="absolute -right-1 -top-1 text-lg" aria-label="Hand raised">✋</span>}
      </button>
      <span className={`mt-1.5 line-clamp-1 font-ui ${big ? "text-sm" : "text-[11px]"} text-white/90`}>{name}</span>
      {badge && <span className="font-ui text-[10px] uppercase tracking-wide text-white/45">{badge}</span>}
      {menu && action && (
        <button type="button" disabled={busy} onClick={() => { setMenu(false); action.run(); }} className="absolute top-full z-10 mt-1 whitespace-nowrap rounded-full bg-white px-3 py-1.5 font-ui text-xs font-bold text-ink shadow-lg">{action.label}</button>
      )}
    </li>
  );
}

// Live mode: the cameras up on stage, or the poster while none is (or on Audio only). A poster is only a picture.
function LiveScreen({ videos, myCam, poster, audioOnly, videoUp, nameOf }: { videos: Record<string, MediaStream>; myCam: MediaStream | null; poster: string; audioOnly: boolean; videoUp: boolean; nameOf: (uid: string) => string }) {
  const tiles = [...Object.entries(videos), ...(myCam ? [["me", myCam] as [string, MediaStream]] : [])];
  if (tiles.length && !(audioOnly && !myCam)) {
    return (
      <div className={`mb-6 grid gap-2 ${tiles.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {tiles.map(([u, st]) => <VideoTile key={u} stream={st} mine={u === "me"} label={u === "me" ? "You" : nameOf(u)} />)}
      </div>
    );
  }
  if (!poster && !(audioOnly && videoUp)) return null;
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl bg-white/[0.06]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {poster ? <img src={poster} alt="The room's poster" className="max-h-[45vh] w-full object-cover" /> : <div className="h-40" />}
      {audioOnly && videoUp && <p className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-xs">Video is on. You&apos;re on Audio only to save data: tap 🔈 Audio only to watch.</p>}
    </div>
  );
}

function VideoTile({ stream, mine, label }: { stream: MediaStream; mine: boolean; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={ref} autoPlay playsInline muted className={`aspect-video w-full object-cover ${mine ? "-scale-x-100" : ""}`} />
      {label && <span className="absolute bottom-2 left-2 rounded bg-black/55 px-2 py-0.5 font-ui text-[11px]">{label}</span>}
    </div>
  );
}

// The poster: upload a picture (made WebP and kept in our storage, like any upload), the profile picture, the challenge art, or none.
function PosterChoice({ value, onChange, onError, light }: { value: { source: PosterSource; url?: string; preview?: string }; onChange: (p: { source: PosterSource; url?: string; preview?: string }) => void; onError: (m: string) => void; light?: boolean }) {
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const chip = (on: boolean) => `rounded-full px-3 py-1 font-ui text-xs font-semibold ${light ? (on ? "bg-crimson text-paper" : "border border-rule text-ink") : on ? "bg-white text-ink" : "bg-white/10 hover:bg-white/20"}`;
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try { const url = await uploadToR2(f, "poster"); onChange({ source: "upload", url, preview: url }); }
    catch (e) { onError(e instanceof Error ? e.message : "Couldn't upload the poster."); }
    finally { setBusy(false); if (file.current) file.current.value = ""; }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs ${light ? "text-slate" : "text-white/60"}`}>Poster (shown while video is off):</span>
      <button type="button" disabled={busy} onClick={() => file.current?.click()} className={chip(value.source === "upload")}>{busy ? "Uploading…" : "Upload"}</button>
      <button type="button" onClick={() => onChange({ source: "profile" })} className={chip(value.source === "profile")}>My profile picture</button>
      <button type="button" onClick={() => onChange({ source: "challenge", preview: CHALLENGE_POSTER })} className={chip(value.source === "challenge")}>Challenge art</button>
      <button type="button" onClick={() => onChange({ source: "none" })} className={chip(value.source === "none")}>None</button>
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value.preview && <img src={value.preview} alt="" className="h-10 w-16 rounded object-cover" />}
    </div>
  );
}
