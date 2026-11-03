"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { audioChoices, chooseMic, chooseRoute, micConstraints, platformOf, readSoundPrefs, SOUND_PREFS_KEY, type Caps, type Dev, type Mic, type Route, type SoundPrefs } from "@/lib/call-audio";
import type { CallKind } from "@/lib/calls";

// Where a call's sound plays and which microphone it uses (lib/call-audio.ts has the rules and what each platform allows). Used by the
// one-to-one call screen and the group call screen. Voice calls start on the earpiece and video calls on the speaker; headphones or
// Bluetooth take over when they're there; the person's own choice is remembered on this device.

type AudioSession = { type: string };
const audioSession = (): AudioSession | null => {
  try { return (navigator as unknown as { audioSession?: AudioSession }).audioSession ?? null; } catch { return null; }
};
type SinkEl = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void>; sinkId?: string };

function capsNow(): Caps {
  if (typeof window === "undefined") return { platform: "desktop", audioSession: false, setSinkId: false, selectAudioOutput: false };
  const md = navigator.mediaDevices as MediaDevices & { selectAudioOutput?: unknown };
  return {
    platform: platformOf(navigator.userAgent, navigator.maxTouchPoints ?? 0),
    audioSession: !!audioSession(),
    setSinkId: typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype,
    selectAudioOutput: typeof md?.selectAudioOutput === "function",
  };
}
const loadPrefs = (): SoundPrefs => { try { return readSoundPrefs(localStorage.getItem(SOUND_PREFS_KEY)); } catch { return {}; } };
const savePrefs = (p: SoundPrefs) => { try { localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(p)); } catch { /* private mode: not remembered */ } };

// Plays an element through the chosen output ("" = the system default), where the browser can.
export function applySink(el: HTMLMediaElement | null | undefined, sinkId: string) {
  const e = el as SinkEl | null | undefined;
  if (!e?.setSinkId || (e.sinkId ?? "") === sinkId) return;
  e.setSinkId(sinkId).catch(() => {});
}

export type CallAudio = {
  routes: Route[]; mics: Mic[]; note: string; routeKey: string; micId: string; sinkId: string; available: boolean;
  pickRoute: (r: Route) => void; pickMic: (deviceId: string) => void;
};

// `ready`: the microphone is on (device names are only readable after that). `stream`: the call's own stream (its audio track is
// swapped when the microphone changes). `senders`: every RTCRtpSender carrying it (one per person in a group call).
export function useCallAudio({ kind, ready, stream, senders, muted }: {
  kind: CallKind; ready: boolean; stream: RefObject<MediaStream | null>; senders: () => RTCRtpSender[]; muted: boolean;
}): CallAudio {
  const caps = useMemo(capsNow, []);
  const prefs = useRef<SoundPrefs>({});
  const [devs, setDevs] = useState<Dev[]>([]);
  const [routeKey, setRouteKey] = useState("");
  const [micId, setMicId] = useState("");
  const [sinkId, setSinkId] = useState("");
  const cur = useRef<{ route: Route | null; input: string }>({ route: null, input: "" });
  const picked = useRef<{ route: Route | null; mic: Mic | null }>({ route: null, mic: null });
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const sendersRef = useRef(senders);
  sendersRef.current = senders;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const choices = useMemo(() => audioChoices(devs, caps), [devs, caps]);

  // iPhone and iPad: the audio session for the call, set before the microphone opens and put back afterwards (the game sounds in
  // Notes Life set "playback"; that comes back when the call ends). "play-and-record" = earpiece on an iPhone, "auto" = speaker.
  useEffect(() => {
    prefs.current = loadPrefs();
    const as = audioSession();
    if (!as || (caps.platform !== "iphone" && caps.platform !== "ipad")) return;
    const before = as.type;
    const first = chooseRoute({ kind, routes: audioChoices([], caps).routes, remembered: prefs.current[kind] });
    try { as.type = first?.session ?? (kind === "audio" ? "play-and-record" : "auto"); } catch { /* not settable here */ }
    if (first) { cur.current.route = first; setRouteKey(first.key); }
    return () => { try { as.type = before; } catch { /* ignore */ } };
    // Once per call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The list of speakers and microphones, again whenever something is plugged in, unplugged, connected or disconnected.
  useEffect(() => {
    if (!ready || !navigator.mediaDevices?.enumerateDevices) return;
    let gone = false;
    const load = () => navigator.mediaDevices.enumerateDevices()
      .then((l) => { if (!gone) setDevs(l.filter((d) => d.kind !== "videoinput").map((d) => ({ kind: d.kind, deviceId: d.deviceId, label: d.label, groupId: d.groupId }))); })
      .catch(() => {});
    void load();
    navigator.mediaDevices.addEventListener?.("devicechange", load);
    return () => { gone = true; navigator.mediaDevices.removeEventListener?.("devicechange", load); };
  }, [ready]);

  // A new microphone track in place of the old one, in the call, without reconnecting (like the front/back camera switch).
  const openInput = useCallback(async (deviceId: string) => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(deviceId) });
    const track = s.getAudioTracks()[0];
    const local = stream.current;
    if (!track) return;
    if (!local || !local.getAudioTracks().some((t) => t.readyState === "live")) { track.stop(); return; } // the call ended meanwhile
    track.enabled = !mutedRef.current;
    await Promise.all(sendersRef.current().filter((x) => x.track?.kind === "audio").map((x) => x.replaceTrack(track).catch(() => {})));
    local.getAudioTracks().forEach((t) => { t.stop(); local.removeTrack(t); });
    local.addTrack(track);
    cur.current.input = deviceId;
  }, [stream]);

  const apply = useCallback((r: Route | null) => {
    queue.current = queue.current.then(async () => {
      try {
        if (r?.kind === "pick") {
          const md = navigator.mediaDevices as MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> };
          const d = await md.selectAudioOutput!();
          const chosen: Route = { key: `sink:${d.deviceId}`, kind: "device", label: d.label || "Speaker", via: "sink", deviceId: d.deviceId };
          picked.current.route = chosen;
          prefs.current = { ...prefs.current, [kind]: { key: chosen.key, kind: chosen.kind, label: chosen.label } };
          savePrefs(prefs.current);
          cur.current.route = chosen; setRouteKey(chosen.key); setSinkId(chosen.deviceId);
          setDevs((l) => (l.some((x) => x.deviceId === d.deviceId && x.kind === "audiooutput") ? l : [...l, { kind: "audiooutput", deviceId: d.deviceId, label: d.label }]));
          return;
        }
        const was = cur.current.route;
        if (!r) {
          // Back to the system default: an Android route or a chosen speaker is let go.
          if (was?.via === "input" && cur.current.input) await openInput("");
          if (was?.via === "sink") setSinkId("");
        } else if (r.via === "session") {
          const as = audioSession();
          if (as && r.session) as.type = r.session;
        } else if (r.via === "input") {
          if (cur.current.input !== r.deviceId) await openInput(r.deviceId);
        } else setSinkId(r.deviceId);
        cur.current.route = r; setRouteKey(r?.key ?? "");
      } catch { /* the device went away or the browser said no: the sound stays where it was */ }
    });
  }, [kind, openInput]);

  // Follow the rules whenever the list changes: the default for the call, a newly plugged-in headset, or a choice that's gone.
  useEffect(() => {
    if (!ready) return;
    const want = chooseRoute({ kind, routes: choices.routes, picked: picked.current.route, remembered: prefs.current[kind] });
    if (choices.routes.length && (want?.key ?? "") !== (cur.current.route?.key ?? "")) apply(want);
    if (!choices.micFollowsRoute && choices.mics.length) {
      const mic = chooseMic(choices.mics, picked.current.mic ?? prefs.current.mic);
      if (mic !== cur.current.input) queue.current = queue.current.then(() => openInput(mic).then(() => setMicId(mic)).catch(() => {}));
    }
  }, [ready, choices, kind, apply, openInput]);

  const pickRoute = useCallback((r: Route) => {
    if (r.kind !== "pick") {
      picked.current.route = r;
      prefs.current = { ...prefs.current, [kind]: { key: r.key, kind: r.kind, label: r.label } };
      savePrefs(prefs.current);
    }
    apply(r);
  }, [kind, apply]);
  const pickMic = useCallback((deviceId: string) => {
    const m = choices.mics.find((x) => x.deviceId === deviceId);
    if (!m) return;
    picked.current.mic = m;
    prefs.current = { ...prefs.current, mic: m };
    savePrefs(prefs.current);
    const id = deviceId === "default" ? "" : deviceId;
    queue.current = queue.current.then(() => openInput(id).then(() => setMicId(id)).catch(() => {}));
  }, [choices.mics, openInput]);

  return {
    routes: choices.routes, mics: choices.mics, note: choices.note, routeKey, micId, sinkId,
    available: choices.routes.length > 1 || choices.mics.length > 1,
    pickRoute, pickMic,
  };
}
