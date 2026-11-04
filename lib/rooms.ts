// Audio rooms in a community (owner, 22 Oct 2026: "Clubhouse style … host appoints a few who can turn on mic, 4 max at any time, others just
// listen"). Admins and moderators host; the host brings up to ROOM_SPEAKERS_MAX members on stage; everyone else listens and can raise a hand.
// Recording only when the host switches it on before going live (lib/live-recording.ts, v0.128.0); everyone is told.
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
  // Relay rooms opened while the live-rooms worker is on (v0.127.0, lib/live-rooms.ts): the chat, the live count, raised hands and stage
  // signals go over a WebSocket to the room's Durable Object; edgeAt is when the worker last reported the count (it then sets listening).
  edge?: boolean; edgeAt?: string;
  // A top-three fan of the host arriving or leaving (lib/fans-server.ts liveEntrance): the latest one, played on every screen.
  entrance?: import("./fans").Entrance;
  // Live mode (lib/rooms-live.ts), relay rooms: whose camera is up now (uid → when it went up; a new time means "pull it again"),
  // whether the host lets speakers turn video on, and the poster everyone sees while video is off (a picture URL, never video).
  // Server-written, like the rest of the room. videoUsedMs: the video minutes this live used, written when it ends (for replays, 2c).
  videoOn?: Record<string, string>; stageVideo?: boolean; poster?: string; videoUsedMs?: number;
  // The host's @username and whether they take paid sessions (publisherSettings session.enabled), so "Book a session" stays in view.
  hostUsername?: string; hostBooks?: boolean;
  // Opened by a #NotesApp team member while the staff test pass was on (lib/staff-pass.ts): no listener cap below the hard ceiling and no
  // video-minutes budget, for as long as the pass stays on.
  staffPass?: boolean;
  // The stage (v0.139.0, lib/rooms.ts "Stage seats"): how people come up (stageModeOf: rooms from before have none and work as Approve),
  // the moderators the host named for this live, invitations waiting for an answer, and speakers whose microphone a host or moderator
  // turned off (they can't turn it back on; on the relay their sound isn't forwarded at all). All server-written.
  stageMode?: StageMode; mods?: Record<string, RoomModInfo>; invites?: Record<string, RoomInvite>; micMuted?: Record<string, string>;
  // pinned: the message or announcement at the top of the chat. consentAsk: a moderator reminded a speaker to agree to the recording.
  pinned?: RoomPin | null; consentAsk?: Record<string, string>;
};
// ── Stage seats (owner, 4 Nov 2026) ──
// The host picks a stage mode and can change it during the live (only the host does):
// - "solo": nobody asks to come up: no raised hands, no + on the empty seats (the host and moderators can still invite someone).
// - "approve": a listener asks for a seat (the + on an empty seat, or the raised hand: the same request); the host or a moderator says yes.
// - "open": a listener taps + on an empty seat and is on stage at once, while there is a seat. Recording consent still comes first in a
//   recorded room (canPush), a room ban or a community ban keeps them off, and a member in teen mode asks instead (the host or a
//   moderator lets them up), so a teen is never pulled in front of a crowd by one tap.
// Moderators for the live: chosen by the host when the room starts or during it (the community's moderators and admins, and anyone in
// the community they name), each with the permissions the host ticks (MOD_PERMS; the presets Basic and Full). The host holds every
// permission. A moderator never acts against the host, nor against another moderator whose permissions aren't a strict part of their own
// (mayActOn), and only the host names moderators or changes their permissions. Every moderator action is logged on the room (modLog).
// The stage powers: approve requests, invite anyone in the room (who accepts or declines), bring a speaker down, and turn a speaker's
// microphone off (micMuted).
export type StageMode = "solo" | "approve" | "open";
export const STAGE_MODES: { id: StageMode; label: string; hint: string }[] = [
  { id: "solo", label: "Solo", hint: "Only you on stage. Nobody can ask to come up; you and your moderators can still invite someone." },
  { id: "approve", label: "Approve", hint: "People ask for a seat; you or a moderator lets them up." },
  { id: "open", label: "Open", hint: "Anyone tapping + on an empty seat comes straight up, while there is a seat (members in teen mode ask instead)." },
];
export const isStageMode = (v: unknown): v is StageMode => v === "solo" || v === "approve" || v === "open";
export const stageModeOf = (r: Pick<RoomDoc, "stageMode">): StageMode => (isStageMode(r.stageMode) ? r.stageMode : "approve");
export const ROOM_MODS_MAX = 10;
export type ModPerm = "approve" | "invite" | "down" | "mic" | "camera" | "chatRemove" | "chatMute" | "ban" | "mode" | "slow" | "pin" | "poster" | "video" | "consent" | "end";
export const MOD_PERMS: { id: ModPerm; label: string }[] = [
  { id: "approve", label: "Approve stage requests" },
  { id: "invite", label: "Invite people on stage" },
  { id: "down", label: "Bring speakers down" },
  { id: "mic", label: "Turn speakers' microphones off and on" },
  { id: "camera", label: "Turn a speaker's camera off" },
  { id: "chatRemove", label: "Remove chat messages" },
  { id: "chatMute", label: "Mute someone in the chat" },
  { id: "ban", label: "Remove someone from this live" },
  { id: "mode", label: "Change the stage mode (Solo, Approve, Open)" },
  { id: "slow", label: "Set the chat's slow mode" },
  { id: "pin", label: "Pin a message or announcement" },
  { id: "poster", label: "Change the poster" },
  { id: "video", label: "Let speakers use video, or take the room back to audio" },
  { id: "consent", label: "Remind speakers to agree to the recording" },
  { id: "end", label: "End the live" },
];
export const ALL_MOD_PERMS: ModPerm[] = MOD_PERMS.map((p) => p.id);
export const MOD_PRESETS: { id: "basic" | "full"; label: string; perms: ModPerm[] }[] = [
  { id: "basic", label: "Basic", perms: ["approve", "invite", "down", "mic", "chatRemove"] },
  { id: "full", label: "Full", perms: ALL_MOD_PERMS.filter((p) => p !== "end") }, // ending the live stays with the host unless ticked
];
export const BASIC_PERMS = MOD_PRESETS[0].perms;
// The community's own moderators (not named for this live) keep the chat powers they had: remove, mute in the chat, remove from the live.
export const COMMUNITY_MOD_PERMS: ModPerm[] = ["chatRemove", "chatMute", "ban"];
export const isModPerm = (v: unknown): v is ModPerm => typeof v === "string" && (ALL_MOD_PERMS as string[]).includes(v);
// What the host sent for one moderator: known permissions, in the list's order; not a list at all: the Basic preset.
export const cleanPerms = (v: unknown): ModPerm[] => (Array.isArray(v) ? ALL_MOD_PERMS.filter((p) => v.includes(p)) : [...BASIC_PERMS]);
// Someone's permissions in this room: the host every one; a named moderator theirs; anyone else none.
export const permsOf = (r: Pick<RoomDoc, "hostUid" | "mods">, uid: string): ModPerm[] =>
  uid === r.hostUid ? ALL_MOD_PERMS : r.mods?.[uid] ? cleanPerms(r.mods[uid].perms) : [];
export const roomCan = (r: Pick<RoomDoc, "hostUid" | "mods">, uid: string, perm: ModPerm) => permsOf(r, uid).includes(perm);
// Whether a set of permissions is a strict part of another (every one of `a` is in `b`, and `b` has more).
export const strictlyWithin = (a: readonly string[], b: readonly string[]) => a.every((p) => b.includes(p)) && b.length > new Set(a).size;
// May `actor` act on `target` (move, mute, remove, take a message down)? Never on the host; the host on anyone; a moderator on anyone
// who isn't a moderator, and on a moderator only when that one's permissions are a strict part of theirs. actorPerms: when the actor's
// permissions come from somewhere else too (the community's moderators' chat powers).
export function mayActOn(r: Pick<RoomDoc, "hostUid" | "mods">, actor: string, target: string, actorPerms: readonly string[] = permsOf(r, actor)): boolean {
  if (!target || target === r.hostUid) return false;
  if (actor === r.hostUid) return true;
  if (actor === target) return false;
  return !isRoomMod(r, target) || strictlyWithin(permsOf(r, target), actorPerms);
}
// A moderator action, kept on the room (communityRooms/{id}/modLog, server-written, read by the host).
export type ModLogEntry = { by: string; byName: string; action: string; target?: string; targetName?: string; at: string };
// The pinned message or announcement at the top of the chat (server-written).
export type RoomPin = { text: string; by: string; byName: string; at: string };
export const ROOM_INVITE_MS = 120_000; // an invitation to the stage is answered within this, or it lapses
export type RoomModInfo = { name: string; avatar: string; perms: ModPerm[] };
export type RoomInvite = { at: string; by: string; byName: string; name: string; avatar: string };
export const isRoomMod = (r: Pick<RoomDoc, "hostUid" | "mods">, uid: string) => !!uid && uid !== r.hostUid && !!r.mods?.[uid];
// Who runs the stage: the host and the moderators they named (each action also needs its permission: roomCan).
export const runsStage = (r: Pick<RoomDoc, "hostUid" | "mods">, uid: string) => uid === r.hostUid || isRoomMod(r, uid);
export const emptySeats = (r: Pick<RoomDoc, "speakers">) => Math.max(0, ROOM_SPEAKERS_MAX - r.speakers.length);
// What + on an empty seat does for this person: nothing (Solo, or no seat left in Open), send a request, or take the seat now.
export type SeatAction = "none" | "request" | "take";
export function seatAction(r: Pick<RoomDoc, "hostUid" | "speakers" | "stageMode">, uid: string, teen = false): SeatAction {
  if (roomRole(r, uid) !== "listener") return "none";
  const mode = stageModeOf(r);
  if (mode === "solo") return "none";
  if (mode === "open" && !teen) return emptySeats(r) > 0 ? "take" : "none";
  return "request";
}
// Whether people may ask for a seat (raise a hand) in this mode.
export const requestsOpen = (r: Pick<RoomDoc, "stageMode">) => stageModeOf(r) !== "solo";
export const inviteFor = (r: Pick<RoomDoc, "invites">, uid: string, now = Date.now()): RoomInvite | null => {
  const i = r.invites?.[uid];
  return i && now - Date.parse(i.at) < ROOM_INVITE_MS ? i : null;
};
export const isMicMuted = (r: Pick<RoomDoc, "micMuted">, uid: string) => !!r.micMuted?.[uid];

// Relay rooms: one listener (communityRooms/{id}/people/{uid}, server-written). chatAt: their last chat message (for slow mode).
// edgeIn (v0.127.0): in a room on the live-rooms worker, the worker last reported this listener connected (they don't heartbeat there).
export type RoomPersonDoc = RoomPerson & { chatAt?: string; edgeIn?: boolean };
// Server-only (communityRooms/{id}/relay/{uid}): the person's Cloudflare session and the microphone track they send, if any.
// video: the camera track they send (Live mode), if any.
export type RoomRelayRecord = { sessionId: string; at: string; push?: { trackName: string; mid: string } | null; video?: { trackName: string; mid: string } | null };
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
export type RoomSettingKey = "relayOn" | "relayListeners" | "p2pListeners" | "chatSlowAbove" | "chatSlowSeconds"
  | "videoOn" | "videoBudgetMinutes" | "videoGraceSeconds" | "videoNearlyLeftMinutes" | "videoBurstMinutes" | "videoTryMinutes"
  | "dropPercent" | "dropWindowMinutes" | "videoKbps" | "videoFps" | "videoHeight";
// group "live": Live mode (lib/rooms-live.ts), shown under its own heading in Admin → Limits → Audio rooms.
export type RoomSettingDef = { key: RoomSettingKey; label: string; unit: string; min: number; max: number; def: number; kind?: "switch"; group?: "live" };
export const ROOM_LISTENERS_MAX_RELAY = 500;
// What the listener setting may be raised to. Rooms are planned for 10,000 listeners (owner, 2 Nov 2026): nothing writes once per
// listener or sends everyone the full list (people/ and the count, above); the default stays at 500 until the owner raises it.
export const ROOM_LISTENERS_CEILING = 10_000;
export const ROOM_SETTINGS: RoomSettingDef[] = [
  { key: "relayOn", label: "Use the Cloudflare relay for audio rooms (only once CLOUDFLARE_REALTIME_APP_ID and _TOKEN are set; rooms already open keep theirs)", unit: "on/off", min: 0, max: 1, def: 1, kind: "switch" },
  { key: "relayListeners", label: "Listeners per room with the relay", unit: "listeners", min: 1, max: ROOM_LISTENERS_CEILING, def: ROOM_LISTENERS_MAX_RELAY },
  { key: "p2pListeners", label: "Listeners per room phone to phone (the host's phone sends to each one)", unit: "listeners", min: 1, max: 30, def: ROOM_LISTENERS_MAX_P2P },
  // Each message is read by everyone in the room, so a big room's chat costs reads fast: slow mode spaces out each listener's messages.
  { key: "chatSlowAbove", label: "Relay rooms: room chat goes into slow mode above this many listeners", unit: "listeners", min: 10, max: ROOM_LISTENERS_CEILING, def: 200 },
  { key: "chatSlowSeconds", label: "Relay rooms: slow mode, seconds between one listener's messages (host and speakers are never slowed)", unit: "seconds", min: 2, max: 300, def: 10 },
  // Live mode (owner, 2 Nov 2026; lib/rooms-live.ts): video through the relay, a poster when it's off, a video-minutes budget per live,
  // and prompts to the host. A poster is only a picture: it never counts as video.
  { key: "videoOn", label: "Live mode: the host (and speakers, if the host allows) can turn video on in relay rooms", unit: "on/off", min: 0, max: 1, def: 1, kind: "switch", group: "live" },
  { key: "videoBudgetMinutes", label: "Video minutes per live (each camera on counts; counted by the server)", unit: "minutes", min: 1, max: 600, def: 15, group: "live" },
  { key: "videoGraceSeconds", label: "When the video minutes run out: the host is told, and video turns off after", unit: "seconds", min: 5, max: 300, def: 30, group: "live" },
  { key: "videoNearlyLeftMinutes", label: "\"Back to audio\" prompt when this many video minutes or fewer are left", unit: "minutes", min: 0, max: 60, def: 2, group: "live" },
  { key: "videoBurstMinutes", label: "\"Back to audio\" prompt once video has been on this long without a break", unit: "minutes", min: 1, max: 120, def: 3, group: "live" },
  { key: "videoTryMinutes", label: "How many minutes of video the drop prompt suggests (\"Try N minutes of video?\")", unit: "minutes", min: 1, max: 30, def: 2, group: "live" },
  { key: "dropPercent", label: "Drop prompt: listeners fell by at least this share", unit: "%", min: 1, max: 90, def: 10, group: "live" },
  { key: "dropWindowMinutes", label: "Drop prompt: within this many minutes", unit: "minutes", min: 1, max: 30, def: 2, group: "live" },
  { key: "videoKbps", label: "Video quality cap per camera", unit: "kbps", min: 150, max: 2_500, def: 600, group: "live" },
  { key: "videoFps", label: "Video frame rate", unit: "frames a second", min: 10, max: 30, def: 24, group: "live" },
  { key: "videoHeight", label: "Video height", unit: "pixels (480 = 480p)", min: 240, max: 720, def: 480, group: "live" },
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
// live: Live mode's figures (lib/rooms-live.ts), for the help and the Audio rooms page. liveChat (v0.127.0): relay rooms carry their chat,
// count and hands on the live-rooms worker (lib/live-rooms.ts); present only when true.
export type RoomLiveFigures = { video: boolean; budgetMinutes: number; graceSeconds: number; nearlyLeftMinutes: number; burstMinutes: number; tryMinutes: number; dropPercent: number; dropWindowMinutes: number; height: number; fps: number; kbps: number };
export type RoomFigures = { relay: boolean; listeners: number; p2pListeners: number; relayListeners: number; speakers: number; chatSlowAbove: number; chatSlowSeconds: number; live: RoomLiveFigures; liveChat?: true };
export const roomLiveFigures = (s: RoomSettings = ROOM_DEFAULTS): RoomLiveFigures => ({
  video: s.videoOn > 0, budgetMinutes: s.videoBudgetMinutes, graceSeconds: s.videoGraceSeconds, nearlyLeftMinutes: s.videoNearlyLeftMinutes, burstMinutes: s.videoBurstMinutes,
  tryMinutes: s.videoTryMinutes, dropPercent: s.dropPercent, dropWindowMinutes: s.dropWindowMinutes, height: s.videoHeight, fps: s.videoFps, kbps: s.videoKbps,
});
export const roomFigures = (s: RoomSettings = ROOM_DEFAULTS, keysSet = false, liveChat = false): RoomFigures => {
  const mode = chooseRoomMode(s, keysSet);
  return { relay: mode === "relay", listeners: listenerCap(mode, s), p2pListeners: s.p2pListeners, relayListeners: s.relayListeners, speakers: ROOM_SPEAKERS_MAX, chatSlowAbove: s.chatSlowAbove, chatSlowSeconds: s.chatSlowSeconds, live: roomLiveFigures(s), ...(liveChat && mode === "relay" ? { liveChat: true as const } : {}) };
};
export const DEFAULT_ROOM_FIGURES = roomFigures();

// ── Presence and the count in relay rooms ──
export const isFresh = (p: Pick<RoomPerson, "seen"> | undefined, now = Date.now()) => !!p && now - Date.parse(p.seen) < ROOM_GONE_MS;
// Rooms on the live-rooms worker (v0.127.0, lib/live-rooms.ts): the worker reports the count to the room doc at most every
// EDGE_DOC_COUNT_MS (edgeAt); after EDGE_STALE_MS without a report our server counts people/ again and listeners heartbeat again.
export const EDGE_DOC_COUNT_MS = 60_000;
export const EDGE_STALE_MS = 150_000;
export const edgeFresh = (r: Pick<RoomDoc, "edge" | "edgeAt">, now = Date.now()) => !!r.edge && !!r.edgeAt && now - Date.parse(r.edgeAt) < EDGE_STALE_MS;
// A relay listener here now: heard from recently (their heartbeat or their join), or, on the live-rooms worker while it reports,
// connected to it (edgeIn), since listeners there don't heartbeat.
export const listenerPresent = (p: RoomPersonDoc | undefined, r: Pick<RoomDoc, "edge" | "edgeAt">, now = Date.now()) => !!p && (isFresh(p, now) || (!!p.edgeIn && edgeFresh(r, now)));
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
// In a recorded room a speaker must have agreed to speak on the record first (lib/live-recording.ts hasConsented). A speaker whose
// microphone the host or a moderator turned off can't send it until they turn it back on (isMicMuted).
export function canPush(r: Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "status" | "mode" | "recording" | "consent" | "micMuted">, uid: string, now = Date.now()): boolean {
  return r.status === "live" && r.mode === "relay" && presentIn(r, now).includes(uid) && roomRole(r, uid) !== "listener" && hasConsented(r, uid) && !isMicMuted(r, uid);
}
// Receive (pull) someone's microphone: anyone here now in a live relay room, from someone else who is on stage and sending.
export function canPull(r: Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "status" | "mode" | "published" | "micMuted">, uid: string, from: string, now = Date.now(), listenerHere = false): boolean {
  return r.status === "live" && r.mode === "relay" && uid !== from && (presentIn(r, now).includes(uid) || listenerHere) && stageOf(r, now).includes(from) && !!r.published?.[from] && !isMicMuted(r, from);
}
// What I should be receiving in a relay room now: each other stage member who is sending, keyed by when they went up (so a new
// microphone is pulled again). Everyone pulls the stage; the stage is at most 1 + ROOM_SPEAKERS_MAX people.
export function pullsFor(r: Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "published" | "micMuted">, me: string, now = Date.now()): { uid: string; key: string }[] {
  return stageOf(r, now).filter((u) => u !== me && r.published?.[u] && !isMicMuted(r, u)).map((u) => ({ uid: u, key: `${u}@${r.published![u]}` }));
}
