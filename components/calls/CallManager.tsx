"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import Avatar from "@/components/Avatar";
import { CALLS_LIVE } from "@/lib/moments-rules";
import { CALL_RING_MS, CALL_STALE_MS, duration, type CallDoc, type CallKind } from "@/lib/calls";

// Free one-to-one calls in Messages. Mounted once in the main layout: it rings for incoming calls anywhere on the site, and opens the call screen
// when you start a call from a conversation (placeCall). The two browsers connect directly (WebRTC); calls/{id} only carries the handshake.
export const CALL_EVENT = "na-call-start";
type Start = { toUid: string; kind: CallKind; name: string; avatar: string };
export const placeCall = (s: Start) => window.dispatchEvent(new CustomEvent<Start>(CALL_EVENT, { detail: s }));

type Active = { role: "caller"; start: Start } | { role: "callee"; id: string; kind: CallKind; name: string; avatar: string };
type Ice = { urls: string | string[]; username?: string; credential?: string }[];

export default function CallManager() {
  const [uid, setUid] = useState<string | null>(null);
  const [ringing, setRinging] = useState<(CallDoc & { id: string }) | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const activeRef = useRef<Active | null>(null);
  activeRef.current = active;

  useEffect(() => (CALLS_LIVE ? onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)) : undefined), []);
  // Incoming calls: anything ringing for me that isn't stale (the caller may have closed their app).
  useEffect(() => {
    if (!uid) { setRinging(null); return; }
    return onSnapshot(query(collection(db, "calls"), where("calleeUid", "==", uid), where("status", "==", "ringing")), (snap) => {
      const fresh = snap.docs.map((d) => ({ ...(d.data() as CallDoc), id: d.id })).filter((c) => Date.now() - Date.parse(c.createdAt) < CALL_STALE_MS).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRinging(activeRef.current ? null : fresh[0] ?? null);
    }, () => setRinging(null));
  }, [uid]);
  useEffect(() => {
    const onStart = (e: Event) => { if (!activeRef.current) setActive({ role: "caller", start: (e as CustomEvent<Start>).detail }); };
    window.addEventListener(CALL_EVENT, onStart);
    return () => window.removeEventListener(CALL_EVENT, onStart);
  }, []);

  if (!CALLS_LIVE || !uid) return null;
  return (
    <>
      {ringing && !active && (
        <Incoming call={ringing}
          onAccept={() => { setActive({ role: "callee", id: ringing.id, kind: ringing.kind, name: ringing.callerName, avatar: ringing.callerAvatar }); setRinging(null); }}
          onDecline={() => { api("/api/calls", { body: { action: "end", id: ringing.id, reason: "declined" } }).catch(() => {}); setRinging(null); }} />
      )}
      {active && <CallScreen active={active} onDone={() => setActive(null)} />}
    </>
  );
}

// A soft two-tone ring while a call is waiting (browsers may keep it silent until the page has been tapped once).
function useRingtone(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let ctx: AudioContext | null = null;
    try { ctx = new AudioContext(); } catch { return; }
    const beep = () => {
      if (!ctx) return;
      [0, 0.25].forEach((t, i) => {
        const o = ctx!.createOscillator(), g = ctx!.createGain();
        o.frequency.value = i ? 660 : 880; g.gain.value = 0.06;
        o.connect(g); g.connect(ctx!.destination); o.start(ctx!.currentTime + t); o.stop(ctx!.currentTime + t + 0.2);
      });
    };
    beep();
    const t = setInterval(beep, 2000);
    return () => { clearInterval(t); ctx?.close().catch(() => {}); };
  }, [on]);
}

function Incoming({ call, onAccept, onDecline }: { call: CallDoc & { id: string }; onAccept: () => void; onDecline: () => void }) {
  useRingtone(true);
  return (
    <div className="fixed inset-x-0 top-4 z-[120] mx-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl bg-ink p-4 text-paper shadow-2xl" role="alertdialog" aria-label={`Incoming call from ${call.callerName}`}>
      <div className="flex items-center gap-3">
        <Avatar src={call.callerAvatar} alt="" size={48} />
        <div className="min-w-0 flex-1"><p className="truncate font-ui font-bold">{call.callerName}</p><p className="text-xs text-paper/70">Incoming {call.kind === "video" ? "video" : "voice"} call</p></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={onDecline} className="rounded-full bg-red-600 py-2.5 font-ui text-sm font-bold">Decline</button>
        <button type="button" onClick={onAccept} className="rounded-full bg-green-600 py-2.5 font-ui text-sm font-bold">Answer</button>
      </div>
    </div>
  );
}

function CallScreen({ active, onDone }: { active: Active; onDone: () => void }) {
  const kind: CallKind = active.role === "caller" ? active.start.kind : active.kind;
  const name = active.role === "caller" ? active.start.name : active.name;
  const avatar = active.role === "caller" ? active.start.avatar : active.avatar;
  const [phase, setPhase] = useState<"starting" | "ringing" | "connecting" | "live" | "over">("starting");
  const [note, setNote] = useState("");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [secs, setSecs] = useState(0);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const local = useRef<MediaStream | null>(null);
  const endRef = useRef<(reason: "ended" | "missed" | "failed") => void>(() => {});
  useRingtone(phase === "ringing" && active.role === "caller");

  useEffect(() => {
    let pc: RTCPeerConnection | null = null;
    let id = active.role === "callee" ? active.id : "";
    let over = false;
    let tick: ReturnType<typeof setInterval> | undefined;
    let ringTimer: ReturnType<typeof setTimeout> | undefined;
    let dropTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubs: (() => void)[] = [];
    const queued: RTCIceCandidateInit[] = [];

    const stop = (message = "") => {
      if (over) return;
      over = true;
      unsubs.forEach((u) => u());
      clearInterval(tick); clearTimeout(ringTimer); clearTimeout(dropTimer);
      pc?.close();
      local.current?.getTracks().forEach((t) => t.stop());
      setPhase("over");
      setNote(message);
      setTimeout(onDone, message ? 1800 : 300);
    };
    const end = (reason: "ended" | "missed" | "failed", message = "") => {
      if (over) return;
      if (id) api("/api/calls", { body: { action: "end", id, reason } }).catch(() => {});
      stop(message);
    };
    endRef.current = (r) => end(r);

    const addRemote = async (c: RTCIceCandidateInit) => {
      if (!pc) return;
      if (!pc.remoteDescription) { queued.push(c); return; }
      await pc.addIceCandidate(c).catch(() => {});
    };
    const flush = async () => { while (queued.length && pc?.remoteDescription) await pc.addIceCandidate(queued.shift()!).catch(() => {}); };

    const wire = (ice: Ice, mine: "callerCandidates" | "calleeCandidates", theirs: "callerCandidates" | "calleeCandidates") => {
      pc = new RTCPeerConnection({ iceServers: ice });
      local.current!.getTracks().forEach((t) => pc!.addTrack(t, local.current!));
      pc.ontrack = (e) => {
        const s = e.streams[0];
        if (remoteVideo.current) remoteVideo.current.srcObject = s;
        if (remoteAudio.current) remoteAudio.current.srcObject = s;
      };
      pc.onicecandidate = (e) => { if (e.candidate) addDoc(collection(db, "calls", id, mine), e.candidate.toJSON()).catch(() => {}); };
      pc.onconnectionstatechange = () => {
        const st = pc?.connectionState;
        if (st === "connected") {
          clearTimeout(dropTimer);
          setPhase((p) => { if (p !== "live") { const t0 = Date.now(); clearInterval(tick); tick = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000); } return "live"; });
        } else if (st === "disconnected") {
          clearTimeout(dropTimer);
          dropTimer = setTimeout(() => end("ended", "The call dropped."), 10_000);
        } else if (st === "failed") end("failed", "The call couldn't connect.");
      };
      unsubs.push(onSnapshot(collection(db, "calls", id, theirs), (snap) => snap.docChanges().forEach((ch) => { if (ch.type === "added") void addRemote(ch.doc.data() as RTCIceCandidateInit); })));
      unsubs.push(onSnapshot(doc(db, "calls", id), async (snap) => {
        const c = snap.data() as CallDoc | undefined;
        if (!c) return;
        if (c.status === "declined") stop(`${name.split(" ")[0]} declined the call.`);
        else if (c.status === "missed") stop(active.role === "caller" ? "No answer." : "");
        else if (c.status === "ended" || c.status === "failed") stop("Call ended.");
        else if (active.role === "caller" && c.answer && pc && !pc.remoteDescription) {
          setPhase("connecting");
          await pc.setRemoteDescription(c.answer as RTCSessionDescriptionInit).catch(() => end("failed", "The call couldn't connect."));
          await flush();
        }
      }));
    };

    (async () => {
      try {
        local.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false });
        if (localVideo.current && kind === "video") localVideo.current.srcObject = local.current;
      } catch {
        if (active.role === "callee") end("failed");
        stop(kind === "video" ? "Allow the camera and microphone to make video calls." : "Allow the microphone to make calls.");
        return;
      }
      if (over) return;
      try {
        if (active.role === "caller") {
          const r = await api<{ id: string; iceServers: Ice }>("/api/calls", { body: { action: "start", toUid: active.start.toUid, kind } });
          id = r.id;
          if (over) { end("missed"); return; }
          wire(r.iceServers, "callerCandidates", "calleeCandidates");
          const offer = await pc!.createOffer();
          await pc!.setLocalDescription(offer);
          await updateDoc(doc(db, "calls", id), { offer: { type: offer.type, sdp: offer.sdp ?? "" } });
          setPhase("ringing");
          ringTimer = setTimeout(() => { if (!pc?.remoteDescription) end("missed", "No answer."); }, CALL_RING_MS);
        } else {
          const { iceServers: ice } = await api<{ iceServers: Ice }>("/api/calls");
          wire(ice, "calleeCandidates", "callerCandidates");
          setPhase("connecting");
          // The offer may land a moment after the call starts ringing.
          let call = (await getDoc(doc(db, "calls", id))).data() as CallDoc | undefined;
          for (let i = 0; i < 20 && call && !call.offer && call.status === "ringing"; i++) { await new Promise((r) => setTimeout(r, 250)); call = (await getDoc(doc(db, "calls", id))).data() as CallDoc | undefined; }
          if (!call?.offer || call.status !== "ringing") { stop("The call has ended."); return; }
          await pc!.setRemoteDescription(call.offer as RTCSessionDescriptionInit);
          await flush();
          const answer = await pc!.createAnswer();
          await pc!.setLocalDescription(answer);
          await updateDoc(doc(db, "calls", id), { answer: { type: answer.type, sdp: answer.sdp ?? "" }, status: "accepted", acceptedAt: new Date().toISOString() });
        }
      } catch (e) {
        end("failed", e instanceof Error ? e.message : "The call couldn't connect.");
      }
    })();
    return () => { if (!over) end("ended"); };
    // One call per screen: everything is set up once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(() => { const m = !muted; local.current?.getAudioTracks().forEach((t) => { t.enabled = !m; }); setMuted(m); }, [muted]);
  const toggleCam = useCallback(() => { const c = !camOff; local.current?.getVideoTracks().forEach((t) => { t.enabled = !c; }); setCamOff(c); }, [camOff]);
  const status = phase === "starting" ? "Starting…" : phase === "ringing" ? "Ringing…" : phase === "connecting" ? "Connecting…" : phase === "live" ? duration(secs) : note || "Call ended";

  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-ink text-paper" role="dialog" aria-modal="true" aria-label={`${kind === "video" ? "Video" : "Voice"} call with ${name}`}>
      {kind === "video" && <video ref={remoteVideo} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />}
      <audio ref={remoteAudio} autoPlay className="hidden" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        {(kind === "audio" || phase !== "live") && <Avatar src={avatar} alt="" size={112} />}
        <p className="font-display text-3xl drop-shadow">{name}</p>
        <p className="font-mono text-sm text-paper/80 drop-shadow" aria-live="polite">{status}</p>
        {kind === "audio" && phase === "live" && <p className="text-xs text-paper/60">Free call · phone to phone</p>}
      </div>
      {kind === "video" && <video ref={localVideo} autoPlay playsInline muted className={`absolute bottom-28 right-4 z-10 h-36 w-24 rounded-xl border border-paper/30 object-cover ${camOff ? "opacity-30" : ""}`} />}
      <div className="relative z-10 flex items-center justify-center gap-5 pb-10">
        <button type="button" onClick={toggleMute} disabled={phase === "over"} aria-pressed={muted} className={`h-14 w-14 rounded-full text-xl ${muted ? "bg-paper text-ink" : "bg-paper/15"}`} aria-label={muted ? "Unmute" : "Mute"}>{muted ? "🔇" : "🎙"}</button>
        {kind === "video" && <button type="button" onClick={toggleCam} disabled={phase === "over"} aria-pressed={camOff} className={`h-14 w-14 rounded-full text-xl ${camOff ? "bg-paper text-ink" : "bg-paper/15"}`} aria-label={camOff ? "Turn camera on" : "Turn camera off"}>{camOff ? "🚫" : "📷"}</button>}
        <button type="button" onClick={() => endRef.current(phase === "ringing" || phase === "starting" ? "missed" : "ended")} disabled={phase === "over"} className="h-16 w-16 rounded-full bg-red-600 text-2xl" aria-label="End call">✕</button>
      </div>
    </div>
  );
}
