// Audio rooms in a community (owner, 22 Oct 2026: "Clubhouse style … host appoints a few who can turn on mic, 4 max at any time, others just
// listen"). Admins and moderators host; the host brings up to ROOM_SPEAKERS_MAX members on stage; everyone else listens and can raise a hand.
// Recording only when the host switches it on before going live (lib/live-recording.ts, v0.127.0); everyone is told.
//
// How the sound travels. Each room keeps the `mode` it opened with, so switching the relay on or off never changes a room already open.
// - "p2p" (phone to phone): everyone on stage (the host and the speakers) connects straight to everyone else on stage, like a group call.
//   Each listener connects only to the host, whose phone mixes the stage into one stream and sends it on. That keeps listeners' data low but
//   puts the host's phone in the middle, so a room holds the p2pListeners setting (ROOM_LISTENERS_MAX_P2P by default).
// - "relay" (v0.124.0): the Cloudflare Realtime relay (an SFU). The host and each speaker send their microphone once to Cloudflare; everyone
//   in the room (the stage too) receives the other stage microphones from there, so a room holds the relayListeners setting (500 by
//   default). New rooms use it when CLOUDFLARE_REALTIME_APP_ID and CLOUDFLARE_REALTIME_APP_TOKEN are set and the relayOn switch (Admin →
//   Limits → Audio rooms) is on. The browser never sees the token: it sends its offers and answers to /api/community/rooms, which checks
//   who may send (host and speakers) and who may receive (anyone in the room) and talks to Cloudflare (lib/rooms-relay-server.ts).
//
// communityRooms/{id}: the room (written only by the server). communityRooms/{id}/links/{auto}: one phone-to-phone connection between two
// people in it, with the offer, the answer and their connection candidates, readable and writable only by those two (firestore.rules).
// communityRooms/{id}/relay/{uid}: each person's Cloudflare session id and microphone track (relay rooms), server-only.
//
// Who is here, at scale (relay rooms): a Firestore document takes about one write a second, so hundreds of listeners can't all beat into
// the room doc. In a relay room the room doc holds only the stage (`joined` = the host and speakers, with their heartbeats), the raised
// hands, and a listener count; each listener has communityRooms/{id}/people/{uid} (server-written, readable only by that person), which
// their heartbeat updates. The count is re-counted from people at most every ROOM_COUNT_EVERY_MS by whichever server handles a join, beat
// or leave first (claimed in a transaction, so one recount per window), which keeps the room doc to a handful of writes a minute. Listeners'
// screens read the stage and the count, and open a paged "People here" list. The room chat goes through the server in relay rooms, with
// slow mode once the room passes the chatSlowAbove setting. Phone-to-phone rooms work as before (everyone in `joined`).

import { hasConsented, type RoomRecordingState } from "./live-recording";

export const ROOM_SPEAKERS_MAX = 4; // on stage besides the host
export const ROOM_LISTENERS_MAX_P2P = 20;
export const ROOM_BEAT_MS = 20_000;
export const ROOM_COUNT_EVERY_MS = 15_000; // relay rooms: the listener count on the room doc is refreshed at most this often
export const ROOM_PEOPLE_PAGE = 50;
export const ROOM_GONE_MS = 60_000;
export const ROOM_TITLE_MAX = 80;
// The room's chat (owner, 22 Oct 2026): everyone in the room can type while it's on: questions, amens, links. It lives in
// communityRooms/{id}/chat, written by the people in the room (firestore.rules checks it's them, with their own name and picture), and
// goes when the room ends. The host (or a moderator of the community) can take a message down.
export const ROOM_CHAT_MAX = 500;
export type RoomChat = { from: string; name: string; avatar: string; text: string; at: string };

export type RoomMode = "p2p" | "relay";
export type RoomPerson = { name: string; avatar: string; at: string; seen: string };
export type RoomDoc = {
  cid: string; communityName: string; title: string; hostUid: string; hostName: string;
  speakers: string[]; hands: Record<string, string>; joined: Record<string, RoomPerson>;
  status: "live" | "ended"; mode: RoomMode; createdAt: string; endedAt?: string; peak?: number;
  // Relay rooms: who is sending their microphone to the relay now (uid → when it went up; a new time means "pull it again"). Written by the
  // server only after it has checked they are on stage.
  published?: Record<string, string>;
  // Why a room the host wanted on the relay runs phone to phone instead (shown to the host).
  note?: string;
  // Relay rooms: the listeners here (counted from people/, at most every ROOM_COUNT_EVERY_MS), when, and the chat's slow mode in seconds
  // (0 = off). handInfo: the name and picture of each raised hand, since listeners aren't in `joined`.
  listening?: number; countedAt?: string; chatSlow?: number;
  handInfo?: Record<string, { name: string; avatar: string }>;
  // Recording (lib/live-recording.ts): set when the room starts recorded; consent: who agreed to speak on the record (uid → when).
  recording?: RoomRecordingState; consent?: Record<string, string>;
};
// Relay rooms: one listener (communityRooms/{id}/people/{uid}, server-written). chatAt: their last chat message (for slow mode).
export type RoomPersonDoc = RoomPerson & { chatAt?: string };
// Server-only (communityRooms/{id}/relay/{uid}): the person's Cloudflare session and the microphone track they send, if any.
export type RoomRelayRecord = { sessionId: string; at: string; push?: { trackName: string; mid: string } | null };
// "stage": two people on stage, both ways. "listen": the host sending the stage's sound to one listener.
export type RoomLinkKind = "stage" | "listen";
export type RoomLink = { from: string; to: string; at: string; kind: RoomLinkKind; offer?: { type: string; sdp: string }; answer?: { type: string; sdp: string } };
export type RoomRole = "host" | "speaker" | "listener";

export const cleanRoomTitle = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, ROOM_TITLE_MAX);
// Who is really still in the room (heard from recently).
export function presentIn(r: Pick<RoomDoc, "joined">, now = Date.now()): string[] {
  return Object.entries(r.joined ?? {}).filter(([, p]) => now - Date.parse(p.seen) < ROOM_GONE_MS).map(([uid]) => uid);
}
export const roomRole = (r: Pick<RoomDoc, "hostUid" | "speakers">, uid: string): RoomRole => (uid === r.hostUid ? "host" : r.speakers.includes(uid) ? "speaker" : "listener");
// Everyone on stage who is here: the host first, then the speakers in the order they came up.
export function stageOf(r: Pick<RoomDoc, "hostUid" | "speakers" | "joined">, now = Date.now()): string[] {
  const here = new Set(presentIn(r, now));
  return [r.hostUid, ...r.speakers].filter((u) => here.has(u));
}
export function listenersOf(r: Pick<RoomDoc, "hostUid" | "speakers" | "joined">, now = Date.now()): string[] {
  const stage = new Set([r.hostUid, ...r.speakers]);
  return presentIn(r, now).filter((u) => !stage.has(u));
}
// Which connections I should have in the room as it is now, and which of them I start (offer): on stage, one with everyone else on stage
// (of each pair, the one with the larger uid offers, so both sides agree without talking); the host, one with every listener (the host
// offers); a listener, one with the host (answered, never offered).
export function linksFor(r: Pick<RoomDoc, "hostUid" | "speakers" | "joined">, me: string, now = Date.now()): { peer: string; kind: RoomLinkKind; offer: boolean }[] {
  const role = roomRole(r, me);
  const stage = stageOf(r, now);
  if (role === "listener") return stage.includes(r.hostUid) ? [{ peer: r.hostUid, kind: "listen", offer: false }] : [];
  const out: { peer: string; kind: RoomLinkKind; offer: boolean }[] = stage.filter((u) => u !== me).map((u) => ({ peer: u, kind: "stage", offer: me > u }));
  if (role === "host") out.push(...listenersOf(r, now).map((u) => ({ peer: u, kind: "listen" as const, offer: true })));
  return out;
}
// Full when the listeners (not the stage) reach the room's cap (listenerCap below).
export const roomIsFull = (r: Pick<RoomDoc, "hostUid" | "speakers" | "joined">, cap: number = ROOM_LISTENERS_MAX_P2P, now = Date.now()) => listenersOf(r, now).length >= cap;

// ── Settings (Admin → Limits → Audio rooms; saved in serverConfig/rooms, read through lib/rooms-server.ts) ──
export type RoomSettingKey = "relayOn" | "relayListeners" | "p2pListeners" | "chatSlowAbove" | "chatSlowSeconds";
export type RoomSettingDef = { key: RoomSettingKey; label: string; unit: string; min: number; max: number; def: number; kind?: "switch" };
export const ROOM_LISTENERS_MAX_RELAY = 500;
export const ROOM_SETTINGS: RoomSettingDef[] = [
  { key: "relayOn", label: "Use the Cloudflare relay for audio rooms (only once CLOUDFLARE_REALTIME_APP_ID and _TOKEN are set; rooms already open keep theirs)", unit: "on/off", min: 0, max: 1, def: 1, kind: "switch" },
  { key: "relayListeners", label: "Listeners per room with the relay", unit: "listeners", min: 1, max: 5_000, def: ROOM_LISTENERS_MAX_RELAY },
  { key: "p2pListeners", label: "Listeners per room phone to phone (the host's phone sends to each one)", unit: "listeners", min: 1, max: 30, def: ROOM_LISTENERS_MAX_P2P },
  // Each message is read by everyone in the room, so a big room's chat costs reads fast: slow mode spaces out each listener's messages.
  { key: "chatSlowAbove", label: "Relay rooms: room chat goes into slow mode above this many listeners", unit: "listeners", min: 10, max: 5_000, def: 200 },
  { key: "chatSlowSeconds", label: "Relay rooms: slow mode, seconds between one listener's messages (host and speakers are never slowed)", unit: "seconds", min: 2, max: 300, def: 10 },
];
export type RoomSettings = Record<RoomSettingKey, number>;
export type RoomOverrides = Partial<RoomSettings>;
export const ROOM_DEFAULTS = Object.fromEntries(ROOM_SETTINGS.map((s) => [s.key, s.def])) as RoomSettings;
export function roomSettings(overrides: RoomOverrides = {}): RoomSettings {
  const out = { ...ROOM_DEFAULTS };
  for (const s of ROOM_SETTINGS) {
    const v = overrides[s.key];
    if (typeof v === "number" && Number.isInteger(v) && v >= s.min && v <= s.max) out[s.key] = v;
  }
  return out;
}
// What an admin sent: whole numbers within each range that differ from the default; anything else is dropped. A switch also takes true/false.
export function cleanRoomOverrides(input: unknown): RoomOverrides {
  const out: RoomOverrides = {};
  if (!input || typeof input !== "object") return out;
  for (const s of ROOM_SETTINGS) {
    const raw = (input as Record<string, unknown>)[s.key];
    const v = typeof raw === "boolean" && s.kind === "switch" ? (raw ? 1 : 0) : Number(raw);
    if (raw !== undefined && raw !== null && raw !== "" && Number.isInteger(v) && v >= s.min && v <= s.max && v !== s.def) out[s.key] = v;
  }
  return out;
}

// Which way a new room's sound travels: the relay only when both keys are set and the switch is on.
export const chooseRoomMode = (s: RoomSettings, keysSet: boolean): RoomMode => (keysSet && s.relayOn > 0 ? "relay" : "p2p");
// How many may listen in a room of this mode (read live, so a changed setting applies to the next person who joins).
export const listenerCap = (mode: RoomMode | undefined, s: RoomSettings): number => (mode === "relay" ? s.relayListeners : s.p2pListeners);
export const roomFullText = (cap: number) => `The room is full: ${cap.toLocaleString("en-GB")} people can listen at a time.`;

// What the help, the public pages and the "Start a room" form say about room size, from the settings: what a room opened now holds.
export type RoomFigures = { relay: boolean; listeners: number; p2pListeners: number; relayListeners: number; speakers: number; chatSlowAbove: number; chatSlowSeconds: number };
export const roomFigures = (s: RoomSettings = ROOM_DEFAULTS, keysSet = false): RoomFigures => {
  const mode = chooseRoomMode(s, keysSet);
  return { relay: mode === "relay", listeners: listenerCap(mode, s), p2pListeners: s.p2pListeners, relayListeners: s.relayListeners, speakers: ROOM_SPEAKERS_MAX, chatSlowAbove: s.chatSlowAbove, chatSlowSeconds: s.chatSlowSeconds };
};
export const DEFAULT_ROOM_FIGURES = roomFigures();

// ── Presence and the count in relay rooms ──
export const isFresh = (p: Pick<RoomPerson, "seen"> | undefined, now = Date.now()) => !!p && now - Date.parse(p.seen) < ROOM_GONE_MS;
// Whether the count on the room doc is due to be refreshed.
export const countDue = (r: Pick<RoomDoc, "countedAt">, now = Date.now()) => !r.countedAt || now - Date.parse(r.countedAt) >= ROOM_COUNT_EVERY_MS;
// Everyone in a room: phone to phone, everyone in `joined`; on the relay, the stage here plus the counted listeners.
export const headcount = (r: Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "mode" | "listening">, now = Date.now()) =>
  r.mode === "relay" ? stageOf(r, now).length + (r.listening ?? 0) : presentIn(r, now).length;
// Listeners in a room, for the screen and the cap: the counted number on the relay, the list phone to phone.
export const listenerCount = (r: Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "mode" | "listening">, now = Date.now()) =>
  r.mode === "relay" ? r.listening ?? 0 : listenersOf(r, now).length;
// Slow mode for the chat (seconds between one listener's messages), from the count and the settings.
export const chatSlowFor = (listening: number, s: RoomSettings) => (listening > s.chatSlowAbove ? s.chatSlowSeconds : 0);
// Seconds a listener still has to wait before their next message (0 = they can send).
export const chatWait = (lastAt: string | undefined, slow: number, now = Date.now()) =>
  !slow || !lastAt ? 0 : Math.max(0, Math.ceil((Date.parse(lastAt) + slow * 1000 - now) / 1000));

// ── Who may do what on the relay (checked by the server before it talks to Cloudflare) ──
// here: whether the caller is in the room. The stage is in `joined`; a relay listener is in people/ (the server passes what it read).
// Send (push) a microphone: the host or a speaker, here now, in a relay room that is live.
// In a recorded room a speaker must have agreed to speak on the record first (lib/live-recording.ts hasConsented).
export function canPush(r: Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "status" | "mode" | "recording" | "consent">, uid: string, now = Date.now()): boolean {
  return r.status === "live" && r.mode === "relay" && presentIn(r, now).includes(uid) && roomRole(r, uid) !== "listener" && hasConsented(r, uid);
}
// Receive (pull) someone's microphone: anyone here now in a live relay room, from someone else who is on stage and sending.
export function canPull(r: Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "status" | "mode" | "published">, uid: string, from: string, now = Date.now(), listenerHere = false): boolean {
  return r.status === "live" && r.mode === "relay" && uid !== from && (presentIn(r, now).includes(uid) || listenerHere) && stageOf(r, now).includes(from) && !!r.published?.[from];
}
// What I should be receiving in a relay room now: each other stage member who is sending, keyed by when they went up (so a new
// microphone is pulled again). Everyone pulls the stage; the stage is at most 1 + ROOM_SPEAKERS_MAX people.
export function pullsFor(r: Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "published">, me: string, now = Date.now()): { uid: string; key: string }[] {
  return stageOf(r, now).filter((u) => u !== me && r.published?.[u]).map((u) => ({ uid: u, key: `${u}@${r.published![u]}` }));
}
