import { ROOM_COUNT_EVERY_MS, presentIn, roomRole, stageOf, type RoomDoc, type RoomSettings } from "./rooms";

// Live mode in audio rooms (owner, 2 Nov 2026), relay rooms only. Pure and client-safe; the server side is lib/rooms-live-server.ts.
//
// - Video: the host (and the speakers, when the host allows it) can turn their camera on and off during a relay room. It goes up to
//   the Cloudflare relay as a second track beside the microphone, on the same connection, capped by the settings (videoHeight,
//   videoFps, videoKbps: 480p, 24 frames a second, about 600 kbps by default). Off goes back to sound only without reconnecting.
// - Poster: while video is off (or for a viewer on Audio only), everyone sees the host's chosen picture: one they upload (WebP, the
//   usual upload pipeline), their profile picture, or the challenge art. A poster is just an image: never sent as video, never counted.
// - Audio only: a viewer can stop pulling video (data saver). It starts on by itself on slow connections (2g/3g or Save-Data) and is
//   remembered on the device.
// - Budget: each live has videoBudgetMinutes of video (each camera on counts), counted by the server from the on and off events. When
//   it runs out the host is told and video turns off by itself after videoGraceSeconds; the relay refuses a new camera after that.
// - Prompts to the host, worked out by the server from the listener count's recent samples: listeners dropping (by dropPercent within
//   dropWindowMinutes) while video is off and minutes are left → "Try N minutes of video?"; a long burst of video (videoBurstMinutes) or
//   few minutes left (videoNearlyLeftMinutes) → "Back to audio to keep your video minutes."
//
// State: the room doc (read by everyone in the room) carries only who has a camera up (videoOn), stageVideo and the poster. The rest is
// in the server-only communityRooms/{id}/live/state (LiveState below): the minutes, the open cameras, the samples and the prompts. That
// keeps the room doc to one write per camera on or off, whatever the room's size.

// ── Who may send and receive video ──
// Turn a camera on: the host; a speaker only when the host allows (stageVideo); here now, in a live relay room, with Live mode on.
export function canVideo(r: Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "status" | "mode" | "stageVideo">, uid: string, s: Pick<RoomSettings, "videoOn">, now = Date.now()): boolean {
  if (r.status !== "live" || r.mode !== "relay" || s.videoOn <= 0 || !presentIn(r, now).includes(uid)) return false;
  const role = roomRole(r, uid);
  return role === "host" || (role === "speaker" && r.stageVideo === true);
}
// Receive someone's camera: anyone here in a live relay room, from another stage member whose camera is up.
export function canPullVideo(r: Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "status" | "mode" | "videoOn">, uid: string, from: string, now = Date.now(), listenerHere = false): boolean {
  return r.status === "live" && r.mode === "relay" && uid !== from && (presentIn(r, now).includes(uid) || listenerHere) && stageOf(r, now).includes(from) && !!r.videoOn?.[from];
}
// The cameras I should be receiving now (none on Audio only), keyed by when each went up.
export function videoPullsFor(r: Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "videoOn">, me: string, audioOnly: boolean, now = Date.now()): { uid: string; key: string }[] {
  if (audioOnly) return [];
  return stageOf(r, now).filter((u) => u !== me && r.videoOn?.[u]).map((u) => ({ uid: u, key: `${u}@${r.videoOn![u]}` }));
}
// Anyone's camera up in the room now (for the poster: shown when nobody's is).
export const anyVideo = (r: Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "videoOn">, now = Date.now()) => stageOf(r, now).some((u) => !!r.videoOn?.[u]);

// The sender's limits, from the settings (RTCRtpEncodingParameters and getUserMedia constraints).
export const videoEncoding = (s: Pick<RoomSettings, "videoKbps" | "videoFps">) => ({ maxBitrate: s.videoKbps * 1000, maxFramerate: s.videoFps });
export const videoConstraints = (s: Pick<RoomSettings, "videoHeight" | "videoFps">) => ({ height: { ideal: s.videoHeight, max: s.videoHeight }, frameRate: { ideal: s.videoFps, max: s.videoFps }, facingMode: "user" });

// ── Audio only (viewers) ──
export const AUDIO_ONLY_KEY = "rooms.audioOnly";
export type NetInfo = { effectiveType?: string; saveData?: boolean } | null | undefined;
// On by itself on a slow connection or with Save-Data on.
export const audioOnlyDefault = (net: NetInfo) => !!net && (net.saveData === true || ["slow-2g", "2g", "3g"].includes(String(net.effectiveType ?? "")));
// What the viewer chose on this device wins; otherwise the default for their connection.
export const chooseAudioOnly = (stored: string | null | undefined, net: NetInfo) => (stored === "1" ? true : stored === "0" ? false : audioOnlyDefault(net));

// ── Posters ──
export type PosterSource = "upload" | "profile" | "challenge" | "none";
// The challenge art (public/images/challenge), a path on our own site: never a domain.
export const CHALLENGE_POSTER = "/images/challenge/challenge-banner.webp";
export const POSTER_FOLDER = "posters";

// ── Video minutes (server-counted) ──
export type LiveSample = { at: string; n: number };
export type LiveState = {
  usedMs: number; // closed camera time so far
  open: Record<string, string>; // uid → when their camera went up (not yet counted)
  burstSince?: string | null; // when video last went from none to some
  graceUntil?: string | null; // the budget ran out: video turns off at this time
  samples: LiveSample[]; // the listener count, at most one every ROOM_COUNT_EVERY_MS
  prompted?: { drop?: string; back?: string; budget?: string }; // when each prompt was last given
};
export const emptyLive = (): LiveState => ({ usedMs: 0, open: {}, burstSince: null, graceUntil: null, samples: [], prompted: {} });
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

// A camera went up. Idempotent: one already up keeps its start.
export function liveVideoOn(st: LiveState, uid: string, at: string): LiveState {
  if (st.open[uid]) return st;
  return { ...st, open: { ...st.open, [uid]: at }, burstSince: Object.keys(st.open).length ? st.burstSince ?? at : at };
}
// A camera went down: its time is added. Idempotent: one that isn't up changes nothing.
export function liveVideoOff(st: LiveState, uid: string, at: string): LiveState {
  const since = st.open[uid];
  if (!since) return st;
  const open = { ...st.open };
  delete open[uid];
  const none = !Object.keys(open).length;
  return { ...st, open, usedMs: st.usedMs + Math.max(0, ms(at) - ms(since)), burstSince: none ? null : st.burstSince, graceUntil: none ? null : st.graceUntil };
}
// Camera time used so far, counting the cameras up now.
export const liveUsedMs = (st: LiveState, now: number) => st.usedMs + Object.values(st.open).reduce((a, since) => a + Math.max(0, now - ms(since)), 0);
export const budgetMs = (s: Pick<RoomSettings, "videoBudgetMinutes">) => s.videoBudgetMinutes * 60_000;
// Whole minutes left, for "12 video minutes left" (rounded down: never promises a minute that isn't there).
export const minutesLeft = (st: LiveState, s: Pick<RoomSettings, "videoBudgetMinutes">, now: number) => Math.max(0, Math.floor((budgetMs(s) - liveUsedMs(st, now)) / 60_000));
export const budgetUsed = (st: LiveState, s: Pick<RoomSettings, "videoBudgetMinutes">, now: number) => liveUsedMs(st, now) >= budgetMs(s);
export const minutesLeftText = (n: number) => `${n} video minute${n === 1 ? "" : "s"} left`;

// Keeps the samples to the drop window and a little more (and at most one per count window).
export function addSample(samples: LiveSample[], n: number, at: string, s: Pick<RoomSettings, "dropWindowMinutes">): LiveSample[] {
  const t = ms(at);
  const last = samples[samples.length - 1];
  if (last && t - ms(last.at) < ROOM_COUNT_EVERY_MS) return samples;
  const keep = s.dropWindowMinutes * 60_000 + ROOM_COUNT_EVERY_MS;
  return [...samples.filter((x) => t - ms(x.at) <= keep), { at, n }].slice(-80);
}
// Listeners dropping: the latest count is at least dropPercent below the highest within the drop window.
export function dropping(samples: LiveSample[], s: Pick<RoomSettings, "dropPercent" | "dropWindowMinutes">, now: number): boolean {
  const recent = samples.filter((x) => now - ms(x.at) <= s.dropWindowMinutes * 60_000);
  if (recent.length < 2) return false;
  const peak = Math.max(...recent.map((x) => x.n)), latest = recent[recent.length - 1].n;
  return peak > 0 && (peak - latest) * 100 >= s.dropPercent * peak;
}

// ── The host's prompts ──
export type LivePromptKind = "drop" | "back" | "budget";
export type LivePrompt = { kind: LivePromptKind; text: string; at: string };
export const promptText = (k: LivePromptKind, s: Pick<RoomSettings, "videoTryMinutes" | "videoGraceSeconds">) =>
  k === "drop" ? `Listeners are dropping. Try ${s.videoTryMinutes} minute${s.videoTryMinutes === 1 ? "" : "s"} of video?`
  : k === "back" ? "Back to audio to keep your video minutes."
  : `Your video minutes for this live are used up. Video turns off in ${s.videoGraceSeconds} seconds.`;

// Which prompt is due now, if any (before the cool-down below):
//  budget: a camera is up and the minutes are used up;
//  back:   a camera is up and the burst passed videoBurstMinutes, or videoNearlyLeftMinutes or fewer are left;
//  drop:   no camera is up, minutes are left, and the listeners are dropping.
export function promptDue(st: LiveState, s: RoomSettings, now: number): LivePromptKind | null {
  const on = Object.keys(st.open).length > 0;
  if (on && budgetUsed(st, s, now)) return "budget";
  if (on) {
    const burst = st.burstSince ? now - ms(st.burstSince) : 0;
    const left = (budgetMs(s) - liveUsedMs(st, now)) / 60_000;
    return burst >= s.videoBurstMinutes * 60_000 || left <= s.videoNearlyLeftMinutes ? "back" : null;
  }
  if (s.videoOn <= 0 || budgetUsed(st, s, now)) return null;
  return dropping(st.samples, s, now) ? "drop" : null;
}
// Each prompt once in a while: drop at most once per drop window; back and budget once per burst.
export function promptFresh(st: LiveState, k: LivePromptKind, s: Pick<RoomSettings, "dropWindowMinutes">, now: number): boolean {
  const last = ms(st.prompted?.[k]);
  if (Number.isNaN(last)) return true;
  if (k === "drop") return now - last >= s.dropWindowMinutes * 60_000;
  return !!st.burstSince && last < ms(st.burstSince);
}

// What the host sees: minutes left and the prompt (kept on screen until the next one or until they act).
export type HostLive = { budgetMinutes: number; minutesLeft: number; videoOn: boolean; prompt: LivePrompt | null; graceUntil: string | null };
