// Audio rooms in a community (owner, 22 Oct 2026: "Clubhouse style … host appoints a few who can turn on mic, 4 max at any time, others just
// listen"). Admins and moderators host; the host brings up to ROOM_SPEAKERS_MAX members on stage; everyone else listens and can raise a hand.
// No recording.
//
// How the sound travels (mode "p2p", for now): everyone on stage (the host and the speakers) connects straight to everyone else on stage, like
// a group call. Each listener connects only to the host, whose phone mixes the stage into one stream and sends it on. That keeps listeners'
// data low but puts the host's phone in the middle, so a room holds ROOM_LISTENERS_MAX_P2P listeners. With the Cloudflare relay (owner:
// "start small, upgrade later"), speakers would send once to the relay and listeners pull from it, for hundreds of listeners; the room keeps
// a `mode` so that can be switched on without changing rooms already open.
//
// communityRooms/{id}: the room (written only by the server). communityRooms/{id}/links/{auto}: one connection between two people in it,
// with the offer, the answer and their connection candidates, readable and writable only by those two (firestore.rules).

export const ROOM_SPEAKERS_MAX = 4; // on stage besides the host
export const ROOM_LISTENERS_MAX_P2P = 20;
export const ROOM_BEAT_MS = 20_000;
export const ROOM_GONE_MS = 60_000;
export const ROOM_TITLE_MAX = 80;
// The room's chat (owner, 22 Oct 2026): everyone in the room can type while it's on: questions, amens, links. It lives in
// communityRooms/{id}/chat, written by the people in the room (firestore.rules checks it's them, with their own name and picture), and
// goes when the room ends. The host (or a moderator of the community) can take a message down.
export const ROOM_CHAT_MAX = 500;
export type RoomChat = { from: string; name: string; avatar: string; text: string; at: string };

export type RoomMode = "p2p";
export type RoomPerson = { name: string; avatar: string; at: string; seen: string };
export type RoomDoc = {
  cid: string; communityName: string; title: string; hostUid: string; hostName: string;
  speakers: string[]; hands: Record<string, string>; joined: Record<string, RoomPerson>;
  status: "live" | "ended"; mode: RoomMode; createdAt: string; endedAt?: string; peak?: number;
};
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
export const roomIsFull = (r: Pick<RoomDoc, "hostUid" | "speakers" | "joined">, now = Date.now()) => listenersOf(r, now).length >= ROOM_LISTENERS_MAX_P2P;
