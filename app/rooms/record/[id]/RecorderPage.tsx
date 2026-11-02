"use client";

import { useEffect, useRef, useState } from "react";

// The recorder page (lib/live-recording-server.ts, docs/RECORDER.md). Run by the room recorder service in headless Chromium, never on a
// phone. With its room token it joins the relay as a silent, receive-only participant (the server allows only pull, answer and close),
// mixes the stage's microphones into one sound, and draws the picture on a canvas: the cameras that are up (Live mode puts each camera up
// as its own track, pulled with video: true; the host's fills the frame, side by side when speakers' are up too), otherwise the room's
// poster image, otherwise a title card. It is never a listener (no heartbeat, no people/ doc), so it's in no count and costs no video
// minutes. Two MediaRecorders run: "stage" (picture and sound) and "audio" (sound only, for
// transcripts). Every ~10 seconds each hands its chunk to the service through window.recorderChunk (exposed by Playwright), which signs
// and uploads it. When the room ends, or the service calls window.recorderStop(), both stop, the last chunks go, and
// window.recorderDone({ hadVideo, seconds }) tells the service to finalize.

type Pull = { uid: string; key: string };
type State = { live: boolean; mode: string; title: string; communityName: string; hostName: string; hostUid: string; poster: string; stage: { uid: string; name: string }[]; pulls: Pull[]; videoPulls: Pull[] };
type RelayRes = { offer?: RTCSessionDescriptionInit | null; renegotiate?: boolean; tracks?: { uid: string; mid: string; kind?: "video" }[] };
declare global {
  interface Window {
    recorderChunk?: (file: "stage" | "audio", seq: number, base64: string) => Promise<void>;
    recorderEvent?: (type: string, detail: string) => Promise<void>;
    recorderDone?: (info: { hadVideo: boolean; seconds: number }) => Promise<void>;
    recorderStop?: () => void;
  }
}
const CHUNK_MS = 10_000;
const toBase64 = async (b: Blob) => { const bytes = new Uint8Array(await b.arrayBuffer()); let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

export default function RecorderPage({ roomId, token }: { roomId: string; token: string }) {
  const [line, setLine] = useState("Starting…");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let over = false;
    const call = async <T,>(body: Record<string, unknown>): Promise<T> => {
      const r = await fetch("/api/rooms/recorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...body }), cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `failed (${r.status})`);
      return j as T;
    };
    const event = (type: string, detail = "") => { void window.recorderEvent?.(type, detail).catch(() => {}); setLine(`${type} ${detail}`); };

    // Sound: every stage microphone into one mix.
    const ctx = new AudioContext();
    const mixOut = ctx.createMediaStreamDestination();
    const silent = ctx.createConstantSource(); silent.offset.value = 0; silent.connect(mixOut); silent.start(); // keeps the track alive with nobody talking
    const sources = new Map<string, MediaStreamAudioSourceNode>();
    // Picture: 1280×720, a few frames a second (a still picture most of the time; full rate while there's video).
    const canvas = canvasRef.current!; canvas.width = 1280; canvas.height = 720;
    const g = canvas.getContext("2d")!;
    const cams = new Map<string, HTMLVideoElement>(); // uid → their camera, while it's up
    let hadVideo = false, state: State | null = null;
    const poster = new Image(); poster.crossOrigin = "anonymous"; let posterSrc = "";
    const draw = () => {
      g.fillStyle = "#1A1210"; g.fillRect(0, 0, 1280, 720);
      // The host first, then speakers in stage order; each gets an equal slice of the width.
      const order = state ? [state.hostUid, ...state.stage.map((x) => x.uid).filter((u) => u !== state!.hostUid)] : [...cams.keys()];
      const live = order.map((u) => cams.get(u)).filter((v): v is HTMLVideoElement => !!v && v.videoWidth > 0);
      if (live.length) {
        const slot = 1280 / live.length;
        live.forEach((v, i) => {
          const k = Math.min(slot / v.videoWidth, 720 / v.videoHeight), w = v.videoWidth * k, h = v.videoHeight * k;
          g.drawImage(v, i * slot + (slot - w) / 2, (720 - h) / 2, w, h);
        });
      } else if (posterSrc && poster.complete && poster.naturalWidth) {
        const k = Math.min(1280 / poster.naturalWidth, 720 / poster.naturalHeight), w = poster.naturalWidth * k, h = poster.naturalHeight * k;
        g.drawImage(poster, (1280 - w) / 2, (720 - h) / 2, w, h);
      } else if (state) {
        g.fillStyle = "#7A0328"; g.fillRect(0, 0, 1280, 720);
        g.fillStyle = "#F6EFE6"; g.textAlign = "center";
        g.font = "600 28px sans-serif"; g.fillText(state.communityName.toUpperCase(), 640, 260);
        g.font = "700 56px serif"; g.fillText(state.title.slice(0, 48), 640, 350);
        g.font = "400 28px sans-serif"; g.fillText(state.stage.map((s) => s.name).join(" · ").slice(0, 80), 640, 430);
      }
    };
    const drawTimer = setInterval(draw, 200);
    const picture = canvas.captureStream(5);
    const mixedTrack = mixOut.stream.getAudioTracks()[0];
    const stageStream = new MediaStream([...picture.getVideoTracks(), mixedTrack]);
    const audioStream = new MediaStream([mixedTrack]);
    const pick = (types: string[]) => types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const recorders = {
      stage: new MediaRecorder(stageStream, { mimeType: pick(["video/webm;codecs=vp8,opus", "video/webm"]), videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 64_000 }),
      audio: new MediaRecorder(audioStream, { mimeType: pick(["audio/webm;codecs=opus", "audio/webm"]), audioBitsPerSecond: 32_000 }),
    };
    const seq = { stage: 0, audio: 0 };
    let sending: Promise<void> = Promise.resolve(); // chunks go one at a time, in order
    for (const kind of ["stage", "audio"] as const) {
      recorders[kind].ondataavailable = (e) => {
        if (!e.data.size) return;
        const n = ++seq[kind];
        sending = sending.then(async () => { await window.recorderChunk?.(kind, n, await toBase64(e.data)); }).catch((err) => event("chunk-failed", String(err)));
      };
    }
    const t0 = Date.now();

    // The relay: one receive-only connection; tracks are pulled as the stage changes (like a listener's, lib/rooms.ts pullsFor).
    const pc = new RTCPeerConnection({ bundlePolicy: "max-bundle" });
    let fresh = true;
    const midToUid = new Map<string, string>();
    const pulled = new Map<string, { uid: string; mid: string; video: boolean }>(); // "a:uid@when" (sound) or "v:uid@when" (camera)
    pc.ontrack = (e) => {
      const uid = e.transceiver?.mid ? midToUid.get(e.transceiver.mid) : undefined;
      if (!uid) return;
      if (e.track.kind === "video") {
        const v = document.createElement("video"); v.muted = true; v.playsInline = true;
        v.srcObject = new MediaStream([e.track]); void v.play().catch(() => {});
        cams.set(uid, v); hadVideo = true;
        e.track.onended = () => { if (cams.get(uid) === v) cams.delete(uid); };
        return;
      }
      sources.get(uid)?.disconnect();
      const src = ctx.createMediaStreamSource(new MediaStream([e.track])); src.connect(mixOut); sources.set(uid, src);
    };
    const relay = async (body: Record<string, unknown>) => { const r = await call<RelayRes>({ action: "relay", ...body, ...(fresh ? { fresh: true } : {}) }); fresh = false; return r; };
    let queue: Promise<unknown> = Promise.resolve();
    const pullSome = async (add: Pull[], video: boolean) => {
      if (!add.length) return;
      const res = await relay({ op: "pull", uids: add.map((a) => a.uid), ...(video ? { video: true } : {}) }).catch(() => null);
      if (!res?.tracks?.length) return;
      for (const t of res.tracks) { const w = add.find((a) => a.uid === t.uid); if (w) { pulled.set(w.key, { uid: t.uid, mid: t.mid, video }); midToUid.set(t.mid, t.uid); } }
      if (res.offer) {
        await pc.setRemoteDescription(res.offer);
        const a = await pc.createAnswer(); await pc.setLocalDescription(a);
        if (res.renegotiate) await relay({ op: "answer", answer: { type: a.type, sdp: a.sdp ?? "" } });
      }
    };
    const sync = (s: State) => { queue = queue.then(async () => {
      const want = [...s.pulls.map((p) => ({ ...p, key: `a:${p.key}` })), ...(s.videoPulls ?? []).map((p) => ({ ...p, key: `v:${p.key}` }))];
      const keys = new Set(want.map((p) => p.key));
      const gone = [...pulled].filter(([k]) => !keys.has(k));
      for (const [k, v] of gone) {
        pulled.delete(k); midToUid.delete(v.mid);
        if (v.video) cams.delete(v.uid); // camera off: back to the poster
        else { sources.get(v.uid)?.disconnect(); sources.delete(v.uid); }
      }
      if (gone.length) await relay({ op: "close", mids: gone.map(([, v]) => v.mid) }).catch(() => {});
      const add = want.filter((p) => !pulled.has(p.key));
      await pullSome(add.filter((p) => p.key.startsWith("a:")), false);
      await pullSome(add.filter((p) => p.key.startsWith("v:")), true);
    }).catch((e) => event("relay-failed", String(e))); };

    let started = false;
    const stop = async () => {
      if (over) return;
      over = true;
      clearInterval(poll); clearInterval(drawTimer);
      const ended = Promise.all((["stage", "audio"] as const).map((k) => new Promise<void>((res) => { const r = recorders[k]; if (r.state === "inactive") return res(); r.onstop = () => res(); r.stop(); })));
      await ended; await sending;
      pc.close(); void ctx.close().catch(() => {});
      await window.recorderDone?.({ hadVideo, seconds: Math.round((Date.now() - t0) / 1000) });
      setLine("Done.");
    };
    window.recorderStop = () => { void stop(); };
    const tick = async () => {
      try {
        const s = await call<State>({ action: "state" });
        state = s;
        if (s.poster && s.poster !== posterSrc) { posterSrc = s.poster; poster.src = s.poster; }
        if (!s.live) { void stop(); return; }
        if (!started) { started = true; recorders.stage.start(CHUNK_MS); recorders.audio.start(CHUNK_MS); event("recording"); }
        sync(s);
      } catch (e) { event("state-failed", String(e)); }
    };
    void ctx.resume();
    const poll = setInterval(tick, 2000);
    void tick();
    return () => { void stop(); };
  }, [roomId, token]);
  return (
    <main style={{ background: "#1A1210", color: "#F6EFE6", minHeight: "100vh", padding: 16, fontFamily: "sans-serif" }}>
      <canvas ref={canvasRef} style={{ width: 640, height: 360 }} />
      <p id="recorder-line">{line}</p>
    </main>
  );
}
