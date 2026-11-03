// Live room chat and signals on the edge (v0.126.0): the protocol and the pure rules shared by the browser (components/community/
// useLiveChannel.ts), our server (lib/live-rooms-server.ts) and the Cloudflare worker (workers/live-rooms, which imports this file and
// lib/rooms.ts into its build). No imports beyond lib/rooms.ts, which is pure too.
//
// Why: in a relay room every message in the Firestore chat is read by everyone in the room, so a 10,000-person room costs 10,000 reads
// a message. On the edge, one Durable Object per room holds everyone's WebSocket and broadcasts the chat, the live count, raised hands
// and stage/video signals; Firestore stays the source of truth for who may be in the room and who is on stage, and keeps the chat's
// record (the worker sends it to our server in batches, LIVE_BATCH_MAX messages or LIVE_BATCH_MS, whichever comes first).
import { ROOM_CHAT_MAX, ROOM_COUNT_EVERY_MS, chatWait } from "./rooms";
import type { LiveRole } from "./live-token";

export const LIVE_FRAME_MAX = 2048; // bytes in one frame from a browser; bigger frames are dropped
export const LIVE_BATCH_MAX = 50; // chat messages per batch to our server
export const LIVE_BATCH_MS = 3_000; // the oldest waiting message is sent within this
export const LIVE_PENDING_MAX = 1_000; // kept while our server can't be reached (the oldest go first)
export const LIVE_RECENT = 50; // the last messages a new socket is given
export const LIVE_COUNT_PUSH_MS = ROOM_COUNT_EVERY_MS; // the count to our server at most this often…
export const LIVE_COUNT_KEEPALIVE_MS = 45_000; // …and at least this often while anyone is connected (so our server knows the edge is alive)
// Whether the worker is reporting this room's count (so our server leaves the count to it instead of counting people/): lib/rooms.ts.
export { edgeFresh, EDGE_DOC_COUNT_MS, EDGE_STALE_MS } from "./rooms";
export const LIVE_COUNT_BROADCAST_MS = 2_000; // the count to the sockets at most this often (not on every join in a 10,000 room)
// Per connection: chat (a burst of 5, then one every 2 s) and signals (hands, video: a burst of 10, then one a second).
export const LIVE_CHAT_RATE: Rate = { burst: 5, perSec: 0.5 };
export const LIVE_SIGNAL_RATE: Rate = { burst: 10, perSec: 1 };

export type LiveChat = { id: string; from: string; name: string; avatar: string; text: string; at: string };
export type LiveHand = { name: string; avatar: string; at: string };
// What our server tells a room (created, settings changed): where to send batches, and the slow-mode settings.
export type LiveConfig = { roomId: string; callback: string; hostUid: string; slowAbove: number; slowSeconds: number };

// Browser → room.
export type LiveClientMsg =
  | { t: "chat"; text: string; nonce?: string }
  | { t: "hand"; up: boolean }
  | { t: "del"; id: string }
  | { t: "mute"; uid: string; on: boolean }
  | { t: "ban"; uid: string }
  | { t: "slow"; on: boolean | null } // host: slow mode on, off, or null = automatic (from the settings and the count)
  | { t: "ping" };
// Room → browser.
export type LiveServerMsg =
  | { t: "hello"; you: { uid: string; role: LiveRole; mod: boolean; muted: boolean }; mutedList?: string[]; count: number; hands: Record<string, LiveHand>; video: Record<string, boolean>; recent: LiveChat[]; slow: number; hostSlow: boolean | null }
  | { t: "chat"; m: LiveChat }
  | { t: "del"; id: string }
  | { t: "count"; n: number }
  | { t: "hand"; uid: string; up: boolean; name?: string; avatar?: string; at?: string }
  | { t: "video"; uid: string; on: boolean }
  | { t: "stage"; uid: string; role: LiveRole }
  | { t: "slow"; slow: number; hostSlow: boolean | null }
  | { t: "muted"; uid: string; on: boolean }
  | { t: "err"; msg: string; nonce?: string; wait?: number }
  | { t: "ended" }
  | { t: "pong" };
// Our server → room (signed): the room's settings, a stage move, a message sent through the server (someone on the Firestore fallback),
// a removal through the server, the room's end.
export type LiveServerOp =
  | { op: "config"; config: LiveConfig }
  | { op: "role"; uid: string; role: LiveRole }
  | { op: "chat"; m: LiveChat }
  | { op: "unchat"; id: string }
  | { op: "video"; uid: string; on: boolean } // a camera went up or down (lib/rooms-live-server.ts markVideoOn/markVideoOff: our server decides)
  | { op: "end" }
  | { op: "ping" }; // /status: proves the address answers and both sides hold the same secret (no state is touched)
// Room → our server (signed), POST to config.callback.
// sessions: each person's time connected (the first tab opening, the last one closing), for the listening-time summary; hands: the
// raised hands' changes (up with name and picture, or null for down), kept by our server so they outlive the room's sockets.
export type LiveSession = { u: string; e: "in" | "out"; at: number; role: LiveRole };
export type LiveBatch = {
  roomId: string; chat: LiveChat[]; removed: string[]; banned: string[]; count?: number; peak?: number; final?: boolean;
  sessions?: LiveSession[]; hands?: Record<string, LiveHand | null>;
};
export const LIVE_SESSIONS_MAX = 2_000; // events kept while our server can't be reached (the oldest go first)
export const LIVE_SESSIONS_BATCH = 500; // events per batch

// ── Rate limits: a token bucket per connection, kept in the socket's attachment (so it survives hibernation) ──
export type Rate = { burst: number; perSec: number };
export type Bucket = { tokens: number; at: number };
export const fullBucket = (r: Rate, now: number): Bucket => ({ tokens: r.burst, at: now });
// Takes one token if there is one: the new bucket, and whether it was allowed.
export function take(b: Bucket | undefined, r: Rate, now: number): { ok: boolean; bucket: Bucket } {
  const cur = b ?? fullBucket(r, now);
  const tokens = Math.min(r.burst, cur.tokens + Math.max(0, now - cur.at) / 1000 * r.perSec);
  return tokens >= 1 ? { ok: true, bucket: { tokens: tokens - 1, at: now } } : { ok: false, bucket: { tokens, at: now } };
}

// ── Slow mode at the edge: automatic past the setting (lib/rooms.ts chatSlowFor), unless the host has switched it on or off ──
export function liveSlow(count: number, c: Pick<LiveConfig, "slowAbove" | "slowSeconds"> | null, hostSlow: boolean | null): number {
  const seconds = c?.slowSeconds ?? 0;
  if (hostSlow === true) return Math.max(seconds, 2);
  if (hostSlow === false || !c) return 0;
  return count > c.slowAbove ? seconds : 0;
}
// Seconds before this person may send again (0 = now). The host and speakers are never slowed.
export const liveWait = (role: LiveRole, lastAtMs: number | undefined, slow: number, now: number) =>
  role !== "listener" || !lastAtMs ? 0 : chatWait(new Date(lastAtMs).toISOString(), slow, now);

export const cleanLiveText = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, ROOM_CHAT_MAX) : "");
// Message ids sort by time, like the server's (lib/rooms-server.ts sendRoomChat), so the batch keeps the order and a removal finds it.
export const liveChatId = (nowMs: number, rand: string) => `${String(nowMs).padStart(13, "0")}_${rand.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "x"}`;
export const isLiveChatId = (v: unknown): v is string => typeof v === "string" && /^\d{13}_[a-zA-Z0-9]{1,8}$/.test(v);

// ── Batching to our server ──
export const batchDue = (pending: number, oldestAtMs: number | undefined, now: number) =>
  pending >= LIVE_BATCH_MAX || (pending > 0 && oldestAtMs !== undefined && now - oldestAtMs >= LIVE_BATCH_MS);
// When the next flush should run (ms since 1970), or null with nothing waiting.
export const nextFlushAt = (pending: number, oldestAtMs: number | undefined, now: number) =>
  pending === 0 || oldestAtMs === undefined ? null : pending >= LIVE_BATCH_MAX ? now : Math.max(now, oldestAtMs + LIVE_BATCH_MS);
// A failed send backs off (5 s, 10 s, 20 s … up to 2 minutes).
export const retryDelay = (fails: number) => Math.min(120_000, 5_000 * 2 ** Math.max(0, fails - 1));
// Keeps the newest LIVE_PENDING_MAX while our server is unreachable.
export const capPending = <T,>(list: T[]) => (list.length > LIVE_PENDING_MAX ? list.slice(list.length - LIVE_PENDING_MAX) : list);

// ── The count to our server: at most every LIVE_COUNT_PUSH_MS when it changed, at least every LIVE_COUNT_KEEPALIVE_MS ──
export function countPushDue(last: { at: number; n: number } | undefined, n: number, now: number): boolean {
  if (!last) return true;
  const since = now - last.at;
  return (since >= LIVE_COUNT_PUSH_MS && n !== last.n) || since >= LIVE_COUNT_KEEPALIVE_MS;
}

// ── The browser: reconnecting ──
// 1 s, 2 s, 4 s … up to 30 s, with a little jitter; after LIVE_FALLBACK_AFTER failures in a row the screen falls back to Firestore.
export const LIVE_FALLBACK_AFTER = 3;
export const reconnectDelay = (fails: number, rand = Math.random()) => Math.round(Math.min(30_000, 1000 * 2 ** Math.max(0, fails - 1)) * (0.8 + 0.4 * rand));
// The worker's address for a room's socket, from NEXT_PUBLIC_LIVE_ROOMS_URL (wss://…); our server uses the https form.
export const liveSocketUrl = (base: string, roomId: string, token: string) => `${base.replace(/\/+$/, "")}/rooms/${encodeURIComponent(roomId)}/ws?t=${encodeURIComponent(token)}`;
export const liveHttpBase = (base: string) => base.trim().replace(/\/+$/, "").replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
