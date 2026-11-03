// Where a call's sound plays (earpiece, speaker, headphones, Bluetooth) and which microphone it uses. Pure helpers, tested in
// tests/calls/audio.test.ts; components/calls/useCallAudio.ts applies them in the browser.
//
// What a web page can and can't steer, per platform (checked against WebKit and Chromium, Nov 2026):
// - iPhone (Safari 16.4+ and the installed app): no setSinkId and no list of speakers. navigator.audioSession.type is the only lever:
//   "play-and-record" plays a call through the earpiece (the receiver at the top of the phone), "auto" while the microphone is on plays
//   it through the loudspeaker. AirPods, Bluetooth and car audio are picked by iOS (Control Centre), not by the page. iPad has no earpiece.
// - Android Chrome: enumerateDevices lists only "default" as an output, so setSinkId can't move a call. But Chrome's microphone list holds
//   its call routes ("Headset earpiece", "Speakerphone", "Wired headset", "Bluetooth headset", "USB audio"): opening the microphone with
//   one of those ids (with echo cancellation on, which puts Android in call mode) moves both the sound and the microphone there. Left on
//   "default", Chrome picks wired > USB > Bluetooth > speakerphone, never the earpiece: that is why voice calls came out of the speaker.
// - Computers (Chrome, Edge, Firefox, Safari 18.4+): setSinkId picks the speaker or headphones, and the microphone can be chosen on its
//   own. Firefox lists speakers only after navigator.mediaDevices.selectAudioOutput(), so it offers "Choose another speaker…".

import type { CallKind } from "./calls";

export type Platform = "iphone" | "ipad" | "android" | "desktop";
export type Dev = { kind: string; deviceId: string; label: string; groupId?: string };
export type RouteKind = "earpiece" | "speaker" | "headphones" | "bluetooth" | "usb" | "default" | "device" | "pick";
export type SessionType = "play-and-record" | "auto";
// How a route is applied: an iPhone audio session type, a microphone id (Android: the sound follows it), or an output id (setSinkId).
export type Route = { key: string; kind: RouteKind; label: string; via: "session" | "input" | "sink"; deviceId: string; session?: SessionType };
export type Mic = { deviceId: string; label: string };
export type Caps = { platform: Platform; audioSession: boolean; setSinkId: boolean; selectAudioOutput: boolean };
export type AudioChoices = { routes: Route[]; mics: Mic[]; micFollowsRoute: boolean; note: string };
export type Remembered = { key: string; kind: RouteKind; label: string };
export type SoundPrefs = { audio?: Remembered; video?: Remembered; mic?: Mic };

export const SOUND_PREFS_KEY = "na-call-sound";
export const ROUTE_LABEL: Record<RouteKind, string> = {
  earpiece: "Earpiece", speaker: "Speaker", headphones: "Headphones", bluetooth: "Bluetooth", usb: "USB audio", default: "System default", device: "Speaker", pick: "Choose another speaker…",
};
const HEADSET: RouteKind[] = ["bluetooth", "headphones", "usb"];
export const isHeadset = (k: RouteKind) => HEADSET.includes(k);

// Chromium's names for Android call routes (media/base/android/.../CommunicationDeviceSelector.java). They're not translated.
const ANDROID_ROUTES: Record<string, RouteKind> = { "Headset earpiece": "earpiece", Speakerphone: "speaker", "Wired headset": "headphones", "Bluetooth headset": "bluetooth", "USB audio": "usb" };
const ANDROID_ORDER: RouteKind[] = ["earpiece", "speaker", "headphones", "bluetooth", "usb"];

export const IPHONE_NOTE = "For AirPods, Bluetooth or a car, pick it in Control Centre: the call follows it.";
export const ANDROID_NOTE = "On Android the microphone moves with the sound: Bluetooth uses the headset's microphone.";
export const NO_ROUTE_NOTE = "This browser doesn't let a web page switch between earpiece and speaker: use your phone's own sound controls.";

export function platformOf(ua: string, touchPoints = 0): Platform {
  if (/iPhone|iPod/.test(ua)) return "iphone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return "ipad"; // iPadOS asks for the desktop site
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

// The microphone for a call: echo cancellation on (on Android it also puts the phone in call mode, so routes apply), and a device if chosen.
export function micConstraints(deviceId = ""): MediaTrackConstraints {
  const c: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (deviceId && deviceId !== "default") c.deviceId = { exact: deviceId };
  return c;
}

// "Default - MacBook Pro Speakers (Built-in)" → "System default (MacBook Pro Speakers)"; no label yet → "Speaker 2".
export function deviceLabel(d: Dev, index: number, noun: "Speaker" | "Microphone"): string {
  const raw = d.label.trim().replace(/\s*\((Built-in|[0-9a-f]{4}:[0-9a-f]{4})\)\s*$/i, "");
  if (d.deviceId === "default") { const inner = raw.replace(/^Default\s*-\s*/i, ""); return inner && !/^default$/i.test(inner) ? `System default (${inner})` : "System default"; }
  return raw || `${noun} ${index + 1}`;
}

const sessionRoutes = (): Route[] => [
  { key: "session:earpiece", kind: "earpiece", label: ROUTE_LABEL.earpiece, via: "session", deviceId: "", session: "play-and-record" },
  { key: "session:speaker", kind: "speaker", label: ROUTE_LABEL.speaker, via: "session", deviceId: "", session: "auto" },
];

// The microphones worth offering: "communications" (a Windows duplicate) left out, "default" first. One microphone means no choice.
function micsOf(devs: Dev[]): Mic[] {
  const list = devs.filter((d) => d.kind === "audioinput" && d.deviceId !== "communications");
  const mics = list.map((d, i) => ({ deviceId: d.deviceId, label: deviceLabel(d, i, "Microphone") }));
  return mics.length > 1 ? mics : [];
}

// What can be chosen on this device, from the browser's device list and what the browser supports.
export function audioChoices(devs: Dev[], caps: Caps): AudioChoices {
  if (caps.platform === "iphone" && caps.audioSession) return { routes: sessionRoutes(), mics: micsOf(devs), micFollowsRoute: false, note: IPHONE_NOTE };
  if (caps.platform === "iphone" || caps.platform === "ipad") return { routes: [], mics: micsOf(devs), micFollowsRoute: false, note: IPHONE_NOTE };
  const inputs = devs.filter((d) => d.kind === "audioinput");
  const android = inputs.filter((d) => ANDROID_ROUTES[d.label]);
  if (android.length) {
    const routes = ANDROID_ORDER.flatMap((k) => android.filter((d) => ANDROID_ROUTES[d.label] === k).slice(0, 1))
      .map((d): Route => { const kind = ANDROID_ROUTES[d.label]; return { key: `input:${d.deviceId}`, kind, label: ROUTE_LABEL[kind], via: "input", deviceId: d.deviceId }; });
    return { routes: routes.length > 1 ? routes : [], mics: [], micFollowsRoute: true, note: ANDROID_NOTE };
  }
  let routes: Route[] = [];
  if (caps.setSinkId) {
    const outs = devs.filter((d) => d.kind === "audiooutput" && d.deviceId !== "communications");
    routes = outs.map((d, i): Route => ({ key: `sink:${d.deviceId}`, kind: d.deviceId === "default" || !d.deviceId ? "default" : "device", label: deviceLabel(d, i, "Speaker"), via: "sink", deviceId: d.deviceId === "default" ? "" : d.deviceId }));
    if (!routes.some((r) => r.kind === "default")) routes.unshift({ key: "sink:", kind: "default", label: ROUTE_LABEL.default, via: "sink", deviceId: "" });
    if (caps.selectAudioOutput) routes.push({ key: "sink:pick", kind: "pick", label: ROUTE_LABEL.pick, via: "sink", deviceId: "" });
    if (routes.length < 2) routes = [];
  }
  return { routes, mics: micsOf(devs), micFollowsRoute: false, note: caps.platform === "android" && !routes.length ? NO_ROUTE_NOTE : "" };
}

const find = (routes: Route[], r: Remembered | Route | null | undefined) =>
  r ? routes.find((x) => x.key === r.key) ?? routes.find((x) => x.kind === r.kind && x.label === r.label && x.kind !== "device") ?? routes.find((x) => x.kind === "device" && x.label === r.label) : undefined;

// Which route a call should use now. Something picked during this call wins while it's there. Otherwise headphones or Bluetooth
// (plugged in or connected, even mid-call) win, unless the remembered choice is itself a headset; then the remembered choice; then
// voice calls go to the earpiece and video calls to the speaker. null: leave it to the system default.
export function chooseRoute(o: { kind: CallKind; routes: Route[]; picked?: Route | null; remembered?: Remembered | null }): Route | null {
  const routes = o.routes.filter((r) => r.kind !== "pick");
  const picked = find(routes, o.picked);
  if (picked) return picked;
  const headset = routes.find((r) => isHeadset(r.kind));
  const remembered = find(routes, o.remembered);
  if (remembered && (!headset || isHeadset(remembered.kind))) return remembered;
  if (headset) return headset;
  return routes.find((r) => r.kind === (o.kind === "audio" ? "earpiece" : "speaker")) ?? null;
}

// The microphone to use: the one picked (or remembered) if it's still there, else the system default ("").
export function chooseMic(mics: Mic[], want: Mic | null | undefined): string {
  if (!want) return "";
  const m = mics.find((x) => x.deviceId === want.deviceId) ?? mics.find((x) => x.label === want.label);
  return m && m.deviceId !== "default" ? m.deviceId : "";
}

// What was remembered on this device; anything unreadable counts as nothing.
export function readSoundPrefs(raw: string | null | undefined): SoundPrefs {
  try {
    const v = JSON.parse(raw ?? "") as SoundPrefs;
    if (!v || typeof v !== "object") return {};
    const ok = (r: unknown): r is Remembered => !!r && typeof (r as Remembered).key === "string" && typeof (r as Remembered).kind === "string" && typeof (r as Remembered).label === "string";
    const okMic = (m: unknown): m is Mic => !!m && typeof (m as Mic).deviceId === "string" && typeof (m as Mic).label === "string";
    return { ...(ok(v.audio) ? { audio: v.audio } : {}), ...(ok(v.video) ? { video: v.video } : {}), ...(okMic(v.mic) ? { mic: v.mic } : {}) };
  } catch { return {}; }
}
