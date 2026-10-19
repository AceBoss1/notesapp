"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import Avatar from "@/components/Avatar";
import { CameraIcon, CrossIcon, MicIcon } from "@/components/calls/CallViews";
import { duration, safetyCode, sdpFingerprint, type CallKind } from "@/lib/calls";
import { GROUP_BEAT_MS, GROUP_CALL_MAX, present, type GroupCallDoc, type GroupLink } from "@/lib/group-calls";

// Group calls in a group chat (lib/group-calls.ts): everyone connects straight to everyone else. CallManager keeps the list of live calls
// in my groups (for ringing, and for the Join button in the chat) and opens this screen.

export type LiveGroupCall = GroupCallDoc & { id: string };
let live: LiveGroupCall[] = [];
const subs = new Set<() => void>();
export function setLiveGroupCalls(list: LiveGroupCall[]) { live = list; subs.forEach((f) => f()); }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useLiveGroupCalls = () => useSyncExternalStore(subscribe, () => live, () => live);

export const GROUP_CALL_EVENT = "na-group-call";
export type GroupStart = { cid: string; title: string; kind: CallKind; id?: string };
// Start a call in a group (or join its live one): from the chat header, a call line, or a ringing card.
export const openGroupCall = (s: GroupStart) => window.dispatchEvent(new CustomEvent<GroupStart>(GROUP_CALL_EVENT, { detail: s }));

type Ice = { urls: string | string[]; username?: string; credential?: string }[];
type Peer = { pc: RTCPeerConnection; stream: MediaStream | null; code: string; linkId: string };

export function GroupCallScreen({ start, me, onDone }: { start: GroupStart; me: string; onDone: () => void }) {
  const kind = start.kind;
  const [id, setId] = useState(start.id ?? "");
  const [call, setCall] = useState<GroupCallDoc | null>(null);
  const [peers, setPeers] = useState<Record<string, { stream: MediaStream | null; code: string }>>({});
  const [note, setNote] = useState("");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [secs, setSecs] = useState(0);
  const [codeFor, setCodeFor] = useState("");
  const local = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const leaveRef = useRef<() => void>(() => {});

  useEffect(() => {
    let over = false, callId = start.id ?? "", myAt = "";
    let ice: Ice = [];
    const conns = new Map<string, Peer>();
    const unsubs: (() => void)[] = [];
    let beat: ReturnType<typeof setInterval> | undefined, tick: ReturnType<typeof setInterval> | undefined;
    const show = () => setPeers(Object.fromEntries([...conns].map(([u, p]) => [u, { stream: p.stream, code: p.code }])));

    const drop = (uid: string) => { const p = conns.get(uid); if (!p) return; p.pc.close(); conns.delete(uid); show(); };
    const finish = (message = "") => {
      if (over) return;
      over = true;
      unsubs.forEach((u) => u()); clearInterval(beat); clearInterval(tick);
      conns.forEach((p) => p.pc.close()); conns.clear();
      local.current?.getTracks().forEach((t) => t.stop());
      setNote(message || "You left the call.");
      setTimeout(onDone, message ? 1800 : 300);
    };
    const leave = (message = "") => { if (callId && !over) api("/api/calls/group", { body: { action: "leave", id: callId } }).catch(() => {}); finish(message); };
    leaveRef.current = () => leave();

    // One connection to one person. `offer` when I'm the newcomer; otherwise the link (with their offer) is answered.
    const connect = async (uid: string, link?: { id: string; data: GroupLink }) => {
      drop(uid);
      const pc = new RTCPeerConnection({ iceServers: ice });
      const peer: Peer = { pc, stream: null, code: "", linkId: link?.id ?? "" };
      conns.set(uid, peer);
      local.current!.getTracks().forEach((t) => pc.addTrack(t, local.current!));
      pc.ontrack = (e) => { peer.stream = e.streams[0]; show(); };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          const a = sdpFingerprint(pc.localDescription?.sdp), b = sdpFingerprint(pc.remoteDescription?.sdp);
          if (a && b) safetyCode(a, b).then((c) => { peer.code = c; show(); }).catch(() => {});
        } else if (pc.connectionState === "failed") drop(uid);
      };
      const queued: RTCIceCandidateInit[] = [];
      const addRemote = async (c: RTCIceCandidateInit) => { if (!pc.remoteDescription) queued.push(c); else await pc.addIceCandidate(c).catch(() => {}); };
      const flush = async () => { while (queued.length && pc.remoteDescription) await pc.addIceCandidate(queued.shift()!).catch(() => {}); };
      const linkCol = collection(db, "groupCalls", callId, "links");
      if (!link) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const ref = await addDoc(linkCol, { from: me, to: uid, at: myAt, offer: { type: offer.type, sdp: offer.sdp ?? "" } });
        peer.linkId = ref.id;
        pc.onicecandidate = (e) => { if (e.candidate) addDoc(collection(db, "groupCalls", callId, "links", ref.id, "fromCandidates"), e.candidate.toJSON()).catch(() => {}); };
        unsubs.push(onSnapshot(collection(db, "groupCalls", callId, "links", ref.id, "toCandidates"), (s) => s.docChanges().forEach((ch) => { if (ch.type === "added") void addRemote(ch.doc.data() as RTCIceCandidateInit); })));
        unsubs.push(onSnapshot(doc(db, "groupCalls", callId, "links", ref.id), async (s) => {
          const l = s.data() as GroupLink | undefined;
          if (l?.answer && !pc.remoteDescription) { await pc.setRemoteDescription(l.answer as RTCSessionDescriptionInit).catch(() => drop(uid)); await flush(); }
        }, () => {}));
      } else {
        pc.onicecandidate = (e) => { if (e.candidate) addDoc(collection(db, "groupCalls", callId, "links", link.id, "toCandidates"), e.candidate.toJSON()).catch(() => {}); };
        unsubs.push(onSnapshot(collection(db, "groupCalls", callId, "links", link.id, "fromCandidates"), (s) => s.docChanges().forEach((ch) => { if (ch.type === "added") void addRemote(ch.doc.data() as RTCIceCandidateInit); })));
        await pc.setRemoteDescription(link.data.offer as RTCSessionDescriptionInit);
        await flush();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(doc(db, "groupCalls", callId, "links", link.id), { answer: { type: answer.type, sdp: answer.sdp ?? "" } });
      }
    };

    (async () => {
      try {
        local.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" ? { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 15 } } : false });
        if (localVideo.current && kind === "video") localVideo.current.srcObject = local.current;
      } catch { finish(kind === "video" ? "Allow the camera and microphone to join video calls." : "Allow the microphone to join calls."); return; }
      if (over) return;
      try {
        let others: string[] = [];
        if (!callId) {
          const r = await api<{ id: string; joined: boolean; iceServers: Ice }>("/api/calls/group", { body: { action: "start", cid: start.cid, kind } });
          callId = r.id; ice = r.iceServers;
        } else {
          const r = await api<{ others: string[]; iceServers: Ice }>("/api/calls/group", { body: { action: "join", id: callId } });
          others = r.others; ice = r.iceServers;
        }
        if (over) { leave(); return; }
        setId(callId);
        let first = true;
        unsubs.push(onSnapshot(doc(db, "groupCalls", callId), (s) => {
          const c = s.data() as GroupCallDoc | undefined;
          if (!c || c.status !== "live") { finish("The call has ended."); return; }
          setCall(c);
          if (!c.joined?.[me]) { if (!first) finish("You left the call."); return; }
          if (first) {
            first = false; myAt = c.joined[me].at;
            // Joining a call that was already going (a start that found one is also a join): I offer to everyone already in it.
            const here = present(c).filter((u) => u !== me);
            if (!others.length) others = here;
            others.forEach((u) => { void connect(u).catch(() => drop(u)); });
            const t0 = Date.now(); tick = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000);
            // People who join after me offer to me.
            unsubs.push(onSnapshot(query(collection(db, "groupCalls", callId, "links"), where("to", "==", me)), (snap) => snap.docChanges().forEach((ch) => {
              const l = ch.doc.data() as GroupLink;
              if (ch.type === "added" && l.offer && !l.answer && l.at > myAt) void connect(l.from, { id: ch.doc.id, data: l }).catch(() => drop(l.from));
            }), () => {}));
          }
          // Someone left (or their app closed): their connection goes.
          const now = present(c);
          [...conns.keys()].forEach((u) => { if (!now.includes(u)) drop(u); });
        }, () => finish("The call has ended.")));
        beat = setInterval(() => { api<{ live: boolean }>("/api/calls/group", { body: { action: "beat", id: callId } }).then((r) => { if (!r.live) finish("The call has ended."); }).catch(() => {}); }, GROUP_BEAT_MS);
      } catch (e) {
        finish(e instanceof Error ? e.message : "Couldn't join the call.");
      }
    })();
    return () => { if (!over) leave(); };
    // One call per screen: everything is set up once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(() => { const m = !muted; local.current?.getAudioTracks().forEach((t) => { t.enabled = !m; }); setMuted(m); }, [muted]);
  const toggleCam = useCallback(() => { const c = !camOff; local.current?.getVideoTracks().forEach((t) => { t.enabled = !c; }); setCamOff(c); }, [camOff]);
  const people = call ? present(call).filter((u) => u !== me) : [];
  const count = people.length + 1;
  const status = note || (!id || !call ? "Connecting…" : people.length ? `${duration(secs)} · ${count} people` : "Waiting for others to join…");
  const tiles = kind === "video" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className="fixed inset-0 z-[130] flex flex-col overflow-hidden bg-ink text-white" role="dialog" aria-modal="true" aria-label={`Group ${kind === "video" ? "video" : "voice"} call in ${start.title}`}
      style={{ backgroundImage: "radial-gradient(ellipse 70% 55% at 50% 55%, rgba(78,1,25,0.8) 0%, rgba(78,1,25,0.3) 45%, rgba(26,18,16,0) 78%)" }}>
      <div className="px-6 pt-[calc(env(safe-area-inset-top)_+_1.25rem)] text-center">
        <p className="font-display text-2xl leading-tight lg:text-3xl">{start.title}</p>
        <p className="mt-1 font-mono text-sm text-white/60" aria-live="polite">{status}</p>
        <p className="mt-1 font-ui text-xs text-white/45">Free group call · phone to phone · up to {GROUP_CALL_MAX[kind]} people · end-to-end encrypted</p>
      </div>
      <div className={`grid flex-1 content-center gap-3 overflow-y-auto p-4 ${tiles}`}>
        <Tile name="You" kind={kind} stream={null} videoRef={localVideo} mirror muted={muted} avatar={call?.joined?.[me]?.avatar ?? ""} />
        {people.map((u) => (
          <Tile key={u} name={call?.joined?.[u]?.name ?? "Someone"} avatar={call?.joined?.[u]?.avatar ?? ""} kind={kind} stream={peers[u]?.stream ?? null}
            code={peers[u]?.code ?? ""} showCode={codeFor === u} onTap={() => setCodeFor((v) => (v === u ? "" : u))} />
        ))}
      </div>
      <div className="flex items-center justify-center gap-5 px-4 pb-[calc(env(safe-area-inset-bottom)_+_1.75rem)] pt-2">
        <Round label={muted ? "Unmute" : "Mute"} pressed={muted} onClick={toggleMute}><MicIcon off={muted} /></Round>
        {kind === "video" && <Round label={camOff ? "Turn camera on" : "Turn camera off"} pressed={camOff} onClick={toggleCam}><CameraIcon off={camOff} /></Round>}
        <button type="button" onClick={() => leaveRef.current()} aria-label="Leave the call" title="Leave the call" className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E5383B] hover:bg-[#D12F32]"><CrossIcon className="h-7 w-7" /></button>
      </div>
    </div>
  );
}

function Round({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={pressed} className={`flex h-14 w-14 items-center justify-center rounded-full text-xl ${pressed ? "bg-white text-ink" : "bg-white/[0.12] hover:bg-white/20"}`}>{children}</button>;
}

// One person in the call: their video (or picture, on a voice call), their name, and the safety code with them on a tap.
function Tile({ name, avatar, kind, stream, videoRef, mirror, muted, code, showCode, onTap }: {
  name: string; avatar: string; kind: CallKind; stream: MediaStream | null; videoRef?: React.RefObject<HTMLVideoElement>; mirror?: boolean; muted?: boolean;
  code?: string; showCode?: boolean; onTap?: () => void;
}) {
  const media = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => { if (media.current && stream && media.current.srcObject !== stream) media.current.srcObject = stream; }, [stream]);
  const video = kind === "video";
  return (
    <button type="button" onClick={onTap} disabled={!onTap} className={`relative overflow-hidden rounded-2xl bg-white/10 text-left ${video ? "aspect-video" : "flex aspect-square flex-col items-center justify-center p-3"}`}>
      {video
        ? <video ref={videoRef ?? media} autoPlay playsInline muted={!!videoRef} className="h-full w-full object-cover" style={mirror ? { transform: "scaleX(-1)" } : undefined} />
        : <><Avatar src={avatar} alt="" size={72} className="!h-16 !w-16" />{!videoRef && <audio ref={media} autoPlay className="hidden" />}</>}
      <span className={`${video ? "absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5" : "mt-2"} font-ui text-xs`}>{name}{muted ? " · muted" : ""}{!videoRef && !stream ? " · connecting…" : ""}</span>
      {code && !showCode && <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 font-ui text-[10px] text-white/70">🔒 code</span>}
      {code && showCode && (
        <span className="absolute inset-x-2 top-2 rounded-xl bg-black/70 px-3 py-2 font-ui text-[11px] text-white/80">
          <span className="block font-mono text-base text-white">{code}</span>{name.split(" ")[0]} sees this code for you. If it matches, nobody else can listen in.
        </span>
      )}
    </button>
  );
}
