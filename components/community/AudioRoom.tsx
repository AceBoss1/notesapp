"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, limitToLast, onSnapshot, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Avatar from "@/components/Avatar";
import { MicIcon } from "@/components/calls/CallViews";
import { duration } from "@/lib/calls";
import { ROOM_BEAT_MS, ROOM_CHAT_MAX, ROOM_LISTENERS_MAX_P2P, ROOM_SPEAKERS_MAX, linksFor, listenersOf, presentIn, roomRole, stageOf, type RoomChat, type RoomDoc, type RoomLink, type RoomLinkKind } from "@/lib/rooms";
import { ago, capi, field } from "./api";

// Audio rooms (lib/rooms.ts): the live rooms on a community's Home, and the room itself. On stage, phones connect to each other; each
// listener connects to the host, whose phone mixes the stage (Web Audio) into the one stream it sends them.

type Ice = { urls: string | string[]; username?: string; credential?: string }[];
type Card = { id: string; title: string; hostName: string; listening: number; speakers: string[]; faces: { name: string; avatar: string }[] };

export function RoomsCard({ cid, canHost, onOpen }: { cid: string; canHost: boolean; onOpen: (id: string, title?: string) => void }) {
  const [rooms, setRooms] = useState<Card[] | null>(null);
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => capi<{ rooms: Card[] }>(`/api/community/rooms?cid=${cid}`).then((d) => setRooms(d.rooms)).catch(() => setRooms([])), [cid]);
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
          try { const r = await capi<{ id: string }>("/api/community/rooms", { action: "start", cid, title }); setOpen(false); setTitle(""); onOpen(r.id, title); }
          catch (x) { setErr(x instanceof Error ? x.message : "Couldn't start the room."); }
        }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="What's it about? e.g. Sunday Q&A" aria-label="Room name" className={`${field} min-w-0 flex-1`} />
          <button className="btn-primary !px-4 !py-2 text-xs" disabled={title.trim().length < 3}>Go live</button>
          <button type="button" className="text-xs text-slate underline" onClick={() => setOpen(false)}>Cancel</button>
          {err && <p className="w-full text-sm text-crimson" role="alert">{err}</p>}
          <p className="w-full text-xs text-slate">You host: bring up to {ROOM_SPEAKERS_MAX} members on stage to speak; everyone else listens and can raise a hand. Up to {ROOM_LISTENERS_MAX_P2P} listeners for now. Nothing is recorded.</p>
        </form>
      )}
      {rooms.length ? (
        <ul className="divide-y divide-rule">
          {rooms.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-ui text-sm font-bold text-ink">{r.title}</p>
                <p className="text-xs text-slate">with {r.hostName}{r.speakers.length ? ` +${r.speakers.length} on stage` : ""} · {r.listening} in the room</p>
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
    const show = () => setStreams(Object.fromEntries([...conns].filter(([, c]) => c.stream).map(([u, c]) => [u, c.stream!])));
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
      unsubs.forEach((u) => u()); clearInterval(beat); clearInterval(tick); clearInterval(levelTimer);
      conns.forEach((c) => c.pc.close()); conns.clear();
      mic?.getTracks().forEach((t) => t.stop());
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
        const r = await capi<{ iceServers: Ice }>("/api/community/rooms", { action: "join", id });
        ice = r.iceServers;
      } catch (e) { finish(e instanceof Error ? e.message : "Couldn't join the room."); return; }
      if (over) return;
      let first = true;
      unsubs.push(onSnapshot(doc(db, "communityRooms", id), (s) => {
        const r = s.data() as RoomDoc | undefined;
        if (!r || r.status !== "live") { finish("The room has ended."); return; }
        if (!r.joined?.[me]) { if (!first) finish("You left the room."); return; }
        latest = r; setRoom(r);
        if (first) {
          first = false; myAt = r.joined[me].at;
          const t0 = Date.parse(r.createdAt); tick = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000);
          unsubs.push(onSnapshot(query(collection(db, "communityRooms", id, "links"), where("to", "==", me)), (snap) => snap.docChanges().forEach((ch) => {
            const l = ch.doc.data() as RoomLink;
            if (ch.type !== "added" || !l.offer || l.answer || Date.parse(l.at) < Date.parse(myAt) - 30_000 || !latest) return;
            const w = linksFor(latest, me).find((x) => x.peer === l.from && x.kind === l.kind && !x.offer);
            if (w) void answer(ch.doc.id, l, latest.joined[l.from]?.at ?? "").catch(() => drop(l.from));
          }), () => {}));
        }
        void reconcile(r);
      }, () => finish("The room has ended.")));
      beat = setInterval(() => { capi<{ live: boolean }>("/api/community/rooms", { action: "beat", id }).then((x) => { if (!x.live) finish("The room has ended."); }).catch(() => {}); }, ROOM_BEAT_MS);
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
  const listeners = room ? listenersOf(room) : [];
  const hands = room ? Object.entries(room.hands ?? {}).filter(([u]) => listeners.includes(u)).sort((a, b) => a[1].localeCompare(b[1])) : [];
  const handUp = !!room?.hands?.[me];
  const toggleMute = () => { const m = !muted; micRef.current?.getAudioTracks().forEach((t) => { t.enabled = !m; }); setMuted(m); };

  return (
    <div className="fixed inset-0 z-[130] flex bg-ink text-white" role="dialog" aria-modal="true" aria-label={`Audio room: ${room?.title ?? title ?? ""}`}
      style={{ backgroundImage: "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(122,3,40,0.55) 0%, rgba(26,18,16,0) 70%)" }}>
      <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-start justify-between gap-3 px-5 pt-[calc(env(safe-area-inset-top)_+_1rem)]">
        <div className="min-w-0">
          <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.25em] text-white/55">{room?.communityName ?? "Audio room"} · <span className="text-[#FF6B6B]">● Live</span> {room ? duration(secs) : ""}</p>
          <h1 className="mt-1 font-display text-2xl leading-tight sm:text-3xl">{room?.title ?? title ?? "Joining…"}</h1>
          <p className="mt-1 text-xs text-white/50" aria-live="polite">{note || (room ? `${stage.length} on stage · ${listeners.length} listening · phone to phone, nothing recorded` : "Connecting…")}</p>
        </div>
        <button type="button" onClick={() => leaveRef.current()} className="shrink-0 rounded-full bg-white/10 px-4 py-2 font-ui text-xs font-semibold hover:bg-white/20">Leave quietly</button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-6">
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
                  <Avatar src={room!.joined[u]?.avatar ?? ""} alt="" size={36} className="!h-9 !w-9 rounded-full" />
                  <span className="min-w-0 flex-1 truncate text-sm">{room!.joined[u]?.name}</span>
                  <button type="button" disabled={busy === u || room!.speakers.length >= ROOM_SPEAKERS_MAX} onClick={() => act({ action: "speaker", uid: u, on: true }, u)} className="rounded-full bg-white px-3 py-1.5 font-ui text-xs font-bold text-ink disabled:opacity-40">Bring up</button>
                </li>
              ))}
            </ul>
            {room!.speakers.length >= ROOM_SPEAKERS_MAX && <p className="mt-2 text-xs text-white/55">The stage is full ({ROOM_SPEAKERS_MAX} speakers besides you). Move someone to listeners first.</p>}
          </div>
        )}
        <p className="mt-8 font-ui text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Listening · {listeners.length}</p>
        <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {listeners.map((u) => (
            <Person key={u} name={u === me ? "You" : room!.joined[u]?.name ?? "Someone"} avatar={room!.joined[u]?.avatar ?? ""} hand={!!room!.hands?.[u]}
              action={role === "host" ? { label: "Invite to speak", run: () => act({ action: "speaker", uid: u, on: true }, u) } : undefined} busy={busy === u} />
          ))}
        </ul>
      </div>

      {Object.entries(streams).map(([u, s]) => <RemoteAudio key={u} stream={s} />)}

      <footer className="flex items-center justify-center gap-4 border-t border-white/10 px-5 pb-[calc(env(safe-area-inset-bottom)_+_1rem)] pt-4">
        {role === "listener" ? (
          <button type="button" onClick={() => act({ action: "hand", up: !handUp })} className={`rounded-full px-5 py-3 font-ui text-sm font-bold ${handUp ? "bg-white text-ink" : "bg-white/10 hover:bg-white/20"}`}>{handUp ? "✋ Hand raised · lower it" : "✋ Raise hand to speak"}</button>
        ) : (
          <>
            <MuteButton muted={muted} onToggle={toggleMute} />
            {role === "speaker" && <button type="button" onClick={() => act({ action: "speaker", uid: me, on: false })} className="rounded-full bg-white/10 px-4 py-3 font-ui text-sm hover:bg-white/20">Back to listening</button>}
          </>
        )}
        <button type="button" onClick={() => { setChatOpen(true); setUnread(0); }} aria-label={`Chat${unread ? `, ${unread} new` : ""}`} className="relative flex h-12 items-center gap-2 rounded-full bg-white/10 px-4 font-ui text-sm font-semibold hover:bg-white/20 lg:hidden">
          💬 Chat{unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E5383B] px-1 text-[10px] font-bold">{unread}</span>}
        </button>
        {role === "host" && <button type="button" onClick={() => confirm("End the room for everyone?") && act({ action: "end" })} className="rounded-full bg-[#E5383B] px-5 py-3 font-ui text-sm font-bold hover:bg-[#D12F32]">End room</button>}
      </footer>
      </div>
      {room && (
        <aside className={`${chatOpen ? "fixed inset-x-0 bottom-0 z-10 flex h-[75vh] rounded-t-3xl shadow-2xl" : "hidden"} flex-col border-white/10 bg-[#211816] lg:static lg:flex lg:h-auto lg:w-96 lg:rounded-none lg:border-l lg:shadow-none`} aria-label="Room chat">
          <RoomChatPanel id={id} me={me} room={room} canRemove={role === "host"} open={chatOpen} onClose={() => setChatOpen(false)} onNew={() => { if (!chatOpen) setUnread((n) => n + 1); }} remove={(mid) => act({ action: "unchat", messageId: mid })} />
        </aside>
      )}
    </div>
  );
}

// The room's chat (lib/rooms.ts): everyone in the room types here while it's on; host and speakers are marked. The newest stays in view.
function RoomChatPanel({ id, me, room, canRemove, open, onClose, onNew, remove }: { id: string; me: string; room: RoomDoc; canRemove: boolean; open: boolean; onClose: () => void; onNew: () => void; remove: (messageId: string) => void }) {
  const [msgs, setMsgs] = useState<(RoomChat & { id: string })[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null); // others' messages already counted (null until the first load, which isn't "new")
  const onNewRef = useRef(onNew); onNewRef.current = onNew;
  useEffect(() => onSnapshot(query(collection(db, "communityRooms", id, "chat"), orderBy("at"), limitToLast(100)), (s) => {
    const list = s.docs.map((d) => ({ ...(d.data() as RoomChat), id: d.id }));
    const theirs = list.filter((m) => m.from !== me).map((m) => m.id);
    if (seen.current) for (const mid of theirs) if (!seen.current.has(mid)) onNewRef.current();
    seen.current = new Set([...(seen.current ?? []), ...theirs]);
    setMsgs(list);
  }, () => {}), [id, me]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length, open]);
  const mine = room.joined[me];
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !mine) return;
    setText(""); setErr("");
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
            {canRemove && m.from !== me && <button type="button" onClick={() => remove(m.id)} className="self-start text-[11px] text-white/40 opacity-0 hover:text-white group-hover:opacity-100 focus:opacity-100">Remove</button>}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t border-white/10 p-3 pb-[calc(env(safe-area-inset-bottom)_+_0.75rem)]">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={ROOM_CHAT_MAX} placeholder="Drop a note in the room…" aria-label="Drop a note in the room" className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:bg-white/15 focus:outline-none" />
        <button className="rounded-full bg-white px-4 py-2.5 font-ui text-sm font-bold text-ink disabled:opacity-40" disabled={!text.trim()}>Send</button>
      </form>
      {err && <p className="px-4 pb-2 text-xs text-[#FF6B6B]" role="alert">{err}</p>}
    </>
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
