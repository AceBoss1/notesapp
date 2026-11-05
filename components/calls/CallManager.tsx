"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { CallStage, IncomingCall } from "@/components/calls/CallViews";
import { GROUP_CALL_EVENT, GroupCallScreen, setLiveGroupCalls, type GroupStart, type LiveGroupCall } from "@/components/calls/GroupCall";
import { ringsFor } from "@/lib/group-calls";
import { CALLS_LIVE } from "@/lib/moments-rules";
import { CALL_RING_MS, CALL_STALE_MS, duration, safetyCode, sdpFingerprint, type CallDoc, type CallKind } from "@/lib/calls";
import { micConstraints } from "@/lib/call-audio";
import { applySink, useCallAudio } from "@/components/calls/useCallAudio";
import { candidateSink, watchRecovery } from "@/components/calls/ice-recovery-client";
import { codeChanged, hasTurn } from "@/lib/ice-recovery";
import PpmMeter, { type MeterState } from "@/components/ppm/PpmMeter";
import { PPM_ADD_STEP, PPM_BEAT_MS } from "@/lib/ppm";

// Free one-to-one calls in Messages. Mounted once in the main layout: it rings for incoming calls anywhere on the site, and opens the call screen
// when you start a call from a conversation (placeCall). The two browsers connect directly (WebRTC); calls/{id} only carries the handshake.
export const CALL_EVENT = "na-call-start";
// ppm: a pay-per-minute session's id (lib/ppm.ts): the server makes the call for the session and meters it.
type Start = { toUid: string; kind: CallKind; name: string; avatar: string; ppm?: string };
export const placeCall = (s: Start) => window.dispatchEvent(new CustomEvent<Start>(CALL_EVENT, { detail: s }));

type Active = { role: "caller"; start: Start } | { role: "callee"; id: string; kind: CallKind; name: string; avatar: string; ppm?: string };
type Ice = { urls: string | string[]; username?: string; credential?: string }[];

export default function CallManager() {
  const [uid, setUid] = useState<string | null>(null);
  const [ringing, setRinging] = useState<(CallDoc & { id: string }) | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const activeRef = useRef<Active | null>(null);
  activeRef.current = active;
  // Group calls: the live ones in my groups, the one ringing me (until I join or say Not now), and the one I'm in.
  const [groupCalls, setGroupCalls] = useState<LiveGroupCall[]>([]);
  const [groupOn, setGroupOn] = useState<GroupStart | null>(null);
  const groupRef = useRef<GroupStart | null>(null);
  groupRef.current = groupOn;
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [, setNow] = useState(0);

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
    const onStart = (e: Event) => { if (!activeRef.current && !groupRef.current) setActive({ role: "caller", start: (e as CustomEvent<Start>).detail }); };
    const onGroup = (e: Event) => { if (!activeRef.current && !groupRef.current) setGroupOn((e as CustomEvent<GroupStart>).detail); };
    window.addEventListener(CALL_EVENT, onStart);
    window.addEventListener(GROUP_CALL_EVENT, onGroup);
    return () => { window.removeEventListener(CALL_EVENT, onStart); window.removeEventListener(GROUP_CALL_EVENT, onGroup); };
  }, []);
  useEffect(() => {
    if (!uid) { setGroupCalls([]); setLiveGroupCalls([]); return; }
    return onSnapshot(query(collection(db, "groupCalls"), where("memberUids", "array-contains", uid), where("status", "==", "live")), (snap) => {
      const list = snap.docs.map((d) => ({ ...(d.data() as LiveGroupCall), id: d.id }));
      setGroupCalls(list); setLiveGroupCalls(list);
    }, () => { setGroupCalls([]); setLiveGroupCalls([]); });
  }, [uid]);
  // A group call stops ringing after 45 seconds even if nothing else changes.
  useEffect(() => { if (!groupCalls.length) return; const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, [groupCalls.length]);
  const groupRing = uid && !active && !groupOn && !ringing ? groupCalls.find((c) => ringsFor(c, uid) && !dismissed.includes(c.id)) ?? null : null;
  // Opened from a group call notification (…?join=<call id>).
  useEffect(() => {
    if (activeRef.current || groupRef.current) return;
    const p = new URLSearchParams(window.location.search);
    const c = groupCalls.find((x) => x.id === p.get("join"));
    if (!c) return;
    p.delete("join"); window.history.replaceState(null, "", window.location.pathname + (p.toString() ? `?${p}` : ""));
    setGroupOn({ cid: c.cid, title: c.title, kind: c.kind, id: c.id });
  }, [groupCalls]);

  const accept = useCallback((c: CallDoc & { id: string }) => { setActive({ role: "callee", id: c.id, kind: c.kind, name: c.callerName, avatar: c.callerAvatar, ...(c.ppm ? { ppm: c.ppm } : {}) }); setRinging(null); }, []);
  // Opened from the ringing notification's Answer (…?answer=<call id>): answer straight away.
  useEffect(() => {
    if (!ringing || activeRef.current) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("answer") === ringing.id) { p.delete("answer"); window.history.replaceState(null, "", window.location.pathname + (p.toString() ? `?${p}` : "")); accept(ringing); }
  }, [ringing, accept]);

  if (!CALLS_LIVE || !uid) return null;
  return (
    <>
      {ringing && !active && (
        <Incoming call={ringing}
          onAccept={() => accept(ringing)}
          onDecline={() => { api("/api/calls", { body: { action: "end", id: ringing.id, reason: "declined" } }).catch(() => {}); setRinging(null); }} />
      )}
      {groupRing && (
        <Incoming call={{ kind: groupRing.kind, callerName: groupRing.startedByName, callerAvatar: groupRing.joined?.[groupRing.startedBy]?.avatar ?? "" }} group={groupRing.title}
          onAccept={() => setGroupOn({ cid: groupRing.cid, title: groupRing.title, kind: groupRing.kind, id: groupRing.id })}
          onDecline={() => setDismissed((d) => [...d, groupRing.id])} />
      )}
      {active && <CallScreen active={active} onDone={() => setActive(null)} />}
      {groupOn && <GroupCallScreen start={groupOn} me={uid} onDone={() => setGroupOn(null)} />}
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

function Incoming({ call, group, onAccept, onDecline }: { call: Pick<CallDoc, "kind" | "callerName" | "callerAvatar">; group?: string; onAccept: () => void; onDecline: () => void }) {
  useRingtone(true);
  return <IncomingCall kind={call.kind} name={call.callerName} avatar={call.callerAvatar} group={group} onAccept={onAccept} onDecline={onDecline} />;
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
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [cams, setCams] = useState(0); // how many cameras this device has (the switch shows when there's more than one)
  const [code, setCode] = useState(""); // the safety code both people can compare (lib/calls.ts)
  // The connection dropped mid-call and is being restarted (lib/ice-recovery.ts); hint: a short line in place of the timer.
  const [reconnecting, setReconnecting] = useState(false);
  const [hint, setHint] = useState("");
  // Screen sharing, on computers only (phone browsers can't capture the screen): your screen replaces your camera in the call, and a
  // message on the call's own data channel tells the other side, so they see the whole screen instead of a cropped one.
  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [theirShare, setTheirShare] = useState(false);
  const screen = useRef<MediaStreamTrack | null>(null);
  const ctl = useRef<RTCDataChannel | null>(null);
  const endRef = useRef<(reason: "ended" | "missed" | "failed") => void>(() => {});
  // A pay-per-minute session (lib/ppm.ts): while the call is connected this phone tells the server every PPM_BEAT_MS; the server's answer
  // is the meter shown over the call (and it ends the call itself when the held minutes run out and none are added).
  const ppm = active.role === "caller" ? active.start.ppm : active.ppm;
  const [meter, setMeter] = useState<MeterState | null>(null);
  const [meterErr, setMeterErr] = useState("");
  const [adding, setAdding] = useState(false);
  useRingtone(phase === "ringing" && active.role === "caller");
  // Where the sound plays (earpiece on voice calls, speaker on video) and which microphone: lib/call-audio.ts.
  const [micOn, setMicOn] = useState(false);
  const sound = useCallAudio({ kind, ready: micOn, stream: local, senders: () => pcRef.current?.getSenders() ?? [], muted });
  useEffect(() => { applySink(remoteAudio.current, sound.sinkId); }, [sound.sinkId]);

  useEffect(() => {
    let pc: RTCPeerConnection | null = null;
    let id = active.role === "callee" ? active.id : "";
    let over = false;
    let tick: ReturnType<typeof setInterval> | undefined;
    let ringTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubs: (() => void)[] = [];
    let iceList: Ice = [];
    let sink: ReturnType<typeof candidateSink> | null = null;
    let recovery: ReturnType<typeof watchRecovery> | null = null;
    let everConnected = false;
    let lastCode = "";

    const stop = (message = "") => {
      if (over) return;
      over = true;
      unsubs.forEach((u) => u());
      clearInterval(tick); clearTimeout(ringTimer);
      recovery?.stop();
      pc?.close();
      local.current?.getTracks().forEach((t) => t.stop());
      screen.current?.stop();
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

    // Candidates wait for the description they belong to (the first one, or a restart's: lib/ice-recovery.ts).
    const addRemote = async (c: RTCIceCandidateInit) => { await sink?.add(c); };
    const flush = async () => { await sink?.flush(); };
    // The safety code, from both fingerprints. A restart keeps the same certificates, so it shouldn't change; if it does, both are asked
    // to compare again.
    const recode = () => {
      const mineFp = sdpFingerprint(pc?.localDescription?.sdp), theirFp = sdpFingerprint(pc?.remoteDescription?.sdp);
      if (!mineFp || !theirFp) return;
      safetyCode(mineFp, theirFp).then((c) => {
        if (codeChanged(lastCode, c)) { setHint("The safety code changed: compare it again."); setTimeout(() => setHint(""), 8000); }
        lastCode = c; setCode(c);
      }).catch(() => {});
    };

    const wire = (ice: Ice, mine: "callerCandidates" | "calleeCandidates", theirs: "callerCandidates" | "calleeCandidates") => {
      iceList = ice;
      pc = new RTCPeerConnection({ iceServers: ice });
      pcRef.current = pc;
      sink = candidateSink(pc);
      local.current!.getTracks().forEach((t) => pc!.addTrack(t, local.current!));
      pc.ontrack = (e) => {
        const s = e.streams[0];
        if (remoteVideo.current) remoteVideo.current.srcObject = s;
        if (remoteAudio.current) remoteAudio.current.srcObject = s;
      };
      const listen = (ch: RTCDataChannel) => {
        ctl.current = ch;
        ch.onmessage = (e) => { try { setTheirShare(JSON.parse(String(e.data)).sharing === true); } catch { /* not ours */ } };
      };
      if (mine === "callerCandidates") listen(pc.createDataChannel("ctl")); // made before the offer, so it is part of it
      else pc.ondatachannel = (e) => listen(e.channel);
      pc.onicecandidate = (e) => { if (e.candidate) addDoc(collection(db, "calls", id, mine), e.candidate.toJSON()).catch(() => {}); };
      pc.onconnectionstatechange = () => {
        const st = pc?.connectionState;
        if (st === "connected") {
          recode();
          setPhase((p) => { if (p !== "live") { const t0 = Date.now(); clearInterval(tick); tick = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000); } return "live"; });
          // Once connected, a drop is recovered (lib/ice-recovery.ts): the caller restarts ICE, the person called answers; the relay
          // is forced only when direct restarts fail, and the call ends only when nothing works (under 30 seconds).
          if (!everConnected && pc) {
            everConnected = true;
            recovery = watchRecovery({
              pc, me: auth.currentUser?.uid ?? active.role, drives: active.role === "caller",
              canRelay: () => hasTurn(iceList),
              freshIce: async () => { const r = await api<{ iceServers: Ice }>("/api/calls"); iceList = r.iceServers; return r.iceServers; },
              sendOffer: (r) => updateDoc(doc(db, "calls", id), { restart: r }),
              sendAnswer: (a) => updateDoc(doc(db, "calls", id), { restartAnswer: a }),
              flush, onReconnecting: setReconnecting, onRecovered: recode,
              onGiveUp: () => end("ended", "The call dropped."),
            });
          }
        } else if (st === "failed" && !everConnected) end("failed", "The call couldn't connect.");
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
        } else if (c.status === "accepted") await recovery?.onSignal(c.restart, c.restartAnswer);
      }));
    };

    (async () => {
      try {
        local.current = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(), video: kind === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false });
        if (localVideo.current && kind === "video") localVideo.current.srcObject = local.current;
        if (!over) setMicOn(true);
        if (kind === "video") navigator.mediaDevices.enumerateDevices().then((d) => setCams(d.filter((x) => x.kind === "videoinput").length)).catch(() => {});
        if (kind === "video") setCanShare(typeof navigator.mediaDevices.getDisplayMedia === "function" && window.matchMedia("(pointer: fine)").matches);
      } catch {
        if (active.role === "callee") end("failed");
        stop(kind === "video" ? "Allow the camera and microphone to make video calls." : "Allow the microphone to make calls.");
        return;
      }
      if (over) return;
      try {
        if (active.role === "caller") {
          const r = active.start.ppm
            ? await api<{ id: string; iceServers: Ice }>("/api/ppm", { body: { action: "call", id: active.start.ppm } })
            : await api<{ id: string; iceServers: Ice }>("/api/calls", { body: { action: "start", toUid: active.start.toUid, kind } });
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
        // permission-denied here means the database's call rules aren't live yet (firestore.rules not deployed), not the mic.
        const denied = (e as { code?: string })?.code === "permission-denied";
        end("failed", denied ? "Calls aren't switched on in the database yet. Please try again later." : e instanceof Error ? e.message : "The call couldn't connect.");
      }
    })();
    return () => { if (!over) end("ended"); };
    // One call per screen: everything is set up once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(() => { const m = !muted; local.current?.getAudioTracks().forEach((t) => { t.enabled = !m; }); setMuted(m); }, [muted]);
  const toggleCam = useCallback(() => { const c = !camOff; local.current?.getVideoTracks().forEach((t) => { t.enabled = !c; }); setCamOff(c); }, [camOff]);
  // Front ↔ back camera during a call: a new video track replaces the old one in the call, without reconnecting.
  const flipCam = useCallback(async () => {
    const next = facing === "user" ? "environment" : "user";
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: next }, width: { ideal: 640 }, height: { ideal: 480 } } });
      const track = s.getVideoTracks()[0];
      if (!track) return;
      track.enabled = !camOff;
      const sender = pcRef.current?.getSenders().find((x) => x.track?.kind === "video");
      await sender?.replaceTrack(track);
      local.current?.getVideoTracks().forEach((t) => { t.stop(); local.current?.removeTrack(t); });
      local.current?.addTrack(track);
      if (localVideo.current) localVideo.current.srcObject = local.current;
      setFacing(next);
    } catch { /* this device has one camera, or it's busy */ }
  }, [facing, camOff]);
  const tell = useCallback((on: boolean) => { if (ctl.current?.readyState === "open") ctl.current.send(JSON.stringify({ sharing: on })); }, []);
  const stopShare = useCallback(async () => {
    const cam = local.current?.getVideoTracks()[0];
    const sender = pcRef.current?.getSenders().find((x) => x.track?.kind === "video" || x.track === screen.current);
    if (cam) await sender?.replaceTrack(cam).catch(() => {});
    screen.current?.stop(); screen.current = null;
    if (localVideo.current) localVideo.current.srcObject = local.current;
    setSharing(false); tell(false);
  }, [tell]);
  const share = useCallback(async () => {
    if (sharing) { await stopShare(); return; }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false });
      const track = s.getVideoTracks()[0];
      if (!track) return;
      track.contentHint = "detail";
      const sender = pcRef.current?.getSenders().find((x) => x.track?.kind === "video");
      await sender?.replaceTrack(track);
      screen.current = track;
      track.onended = () => { void stopShare(); }; // "Stop sharing" in the browser's own bar
      if (localVideo.current) localVideo.current.srcObject = new MediaStream([track]);
      setSharing(true); tell(true);
    } catch { /* they closed the picker */ }
  }, [sharing, stopShare, tell]);
  useEffect(() => {
    if (!ppm || phase !== "live") return;
    let on = true;
    const beat = () => api<MeterState>("/api/ppm", { body: { action: "beat", id: ppm } }).then((m) => { if (on) setMeter(m); }).catch(() => {});
    void beat();
    const t = setInterval(beat, PPM_BEAT_MS);
    return () => { on = false; clearInterval(t); };
  }, [ppm, phase]);
  // The held minutes ran out and the wait is over: the server has ended (or is ending) the session; this phone hangs up too.
  useEffect(() => {
    if (!meter?.askTopUp || !meter.meter.endsAt) return;
    const t = setTimeout(() => endRef.current("ended"), Math.max(0, Date.parse(meter.meter.endsAt) - Date.now()) + 1500);
    return () => clearTimeout(t);
  }, [meter]);
  const addMinutes = useCallback(async () => {
    if (!ppm) return;
    setAdding(true); setMeterErr("");
    try { setMeter(await api<MeterState>("/api/ppm", { body: { action: "add", id: ppm, minutes: PPM_ADD_STEP } })); }
    catch (e) { setMeterErr(e instanceof Error ? e.message : "Couldn't add minutes."); }
    finally { setAdding(false); }
  }, [ppm]);
  const status = phase === "starting" ? "Starting…" : phase === "ringing" ? "Ringing…" : phase === "connecting" ? "Connecting…"
    // A pay-per-minute call shows the server's meter below, not this phone's own count.
    : phase === "live" ? (reconnecting ? "Reconnecting…" : hint || (ppm ? "Connected" : duration(secs))) : note || "Call ended";

  return (
    <CallStage kind={kind} name={name} avatar={avatar} status={status} live={phase === "live"} over={phase === "over"}
      muted={muted} camOff={camOff} canFlip={cams !== 1 && !sharing} facing={facing}
      safetyCode={phase === "live" ? code : ""} canShare={canShare && phase === "live"} sharing={sharing} theirShare={theirShare} onShare={share}
      onMute={toggleMute} onFlip={flipCam} onCam={toggleCam} onEnd={() => endRef.current(phase === "ringing" || phase === "starting" ? "missed" : "ended")}
      remoteVideo={remoteVideo} localVideo={localVideo} remoteAudio={remoteAudio} sound={sound}
      paidNote={ppm ? "Pay-per-minute session" : undefined}
      extra={ppm && meter && phase === "live" ? <PpmMeter overlay state={meter} onAdd={addMinutes} busy={adding} error={meterErr} /> : undefined} />
  );
}
