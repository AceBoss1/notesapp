import type { Firestore } from "firebase-admin/firestore";
import { setting } from "./config";
import { SITE_URL } from "./host";
import { LIVE_SIG_HEADER, signBody } from "./live-token";
import { liveHttpBase, type LiveConfig, type LiveServerOp } from "./live-rooms";
import { EDGE_STALE_MS, type RoomSettings } from "./rooms";
import type { LiveHand } from "./live-rooms";

// Our server's side of the live-rooms worker (workers/live-rooms; lib/live-rooms.ts): whether it is switched on, and the signed calls
// from our server to a room's Durable Object. No Firestore here, so lib/rooms-server.ts can call it without a cycle; minting tokens and
// taking in the worker's batches are in lib/live-rooms-server.ts.

// On when both the worker's address and the shared secret are set. Rooms opened while it's on are marked `edge` and keep it.
export const liveRoomsUrl = () => (setting("NEXT_PUBLIC_LIVE_ROOMS_URL") ?? "").trim();
export const liveRoomsSecret = () => (setting("LIVE_ROOMS_SECRET") ?? "").trim();
export const liveRoomsOn = () => /^wss?:\/\/[^/\s]+/i.test(liveRoomsUrl()) && liveRoomsSecret().length >= 16;
// Where the worker sends a room's chat batches and count: this site's own address (lib/host.ts), never a hard-coded domain.
export const liveCallbackUrl = () => `${SITE_URL}/api/community/rooms/edge`;
export const liveConfigFor = (roomId: string, hostUid: string, s: Pick<RoomSettings, "chatSlowAbove" | "chatSlowSeconds">): LiveConfig =>
  ({ roomId, callback: liveCallbackUrl(), hostUid, slowAbove: s.chatSlowAbove, slowSeconds: s.chatSlowSeconds });

// Tests swap the transport for a stand-in.
type Fetch = (url: string, init: RequestInit) => Promise<Response>;
let transport: Fetch = (url, init) => fetch(url, init);
export const setLiveTransport = (f: Fetch | null) => { transport = f ?? ((url, init) => fetch(url, init)); };

// One signed POST to the room's object. Never throws: the room carries on through Firestore if the worker can't be reached.
export async function tellLiveRoom(roomId: string, op: LiveServerOp, now = Date.now()): Promise<boolean> {
  if (!liveRoomsOn()) return false;
  const body = JSON.stringify(op);
  try {
    const res = await transport(`${liveHttpBase(liveRoomsUrl())}/rooms/${encodeURIComponent(roomId)}/server`, {
      method: "POST", headers: { "content-type": "application/json", [LIVE_SIG_HEADER]: await signBody(liveRoomsSecret(), body, now) }, body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) console.warn("[live-rooms] the worker refused", op.op, res.status);
    return res.ok;
  } catch (e) {
    console.warn("[live-rooms] couldn't reach the worker:", op.op, e instanceof Error ? e.message : e);
    return false;
  }
}

// communityRooms/{id}/edge/state (server-only): bans for the room, when the settings were last sent, the exact count and raised hands
// as the worker last reported them, and the room's final peak.
export type EdgeState = { banned?: Record<string, string>; configAt?: string; finalPeak?: number; count?: number; countAt?: string; hands?: Record<string, LiveHand> };
export const edgeState = (db: Firestore, roomId: string) => db.doc(`communityRooms/${roomId}/edge/state`);
export const readEdgeState = async (db: Firestore, roomId: string) => ((await edgeState(db, roomId).get()).data() ?? {}) as EdgeState;
// The exact listener count from the worker while it reports (the cap's count in these rooms), or null.
export const edgeCount = (st: EdgeState, now = Date.now()) => (typeof st.count === "number" && st.countAt && now - Date.parse(st.countAt) < EDGE_STALE_MS ? st.count : null);

// /status (lib/status.ts): the worker answers at NEXT_PUBLIC_LIVE_ROOMS_URL, has its secret, and it matches ours (a signed "ping" to a
// room that never holds anything). why: what to fix, in words; never the secret.
export async function liveRoomsCheck(f: typeof fetch = fetch, signal?: AbortSignal): Promise<{ ok: boolean; why?: string }> {
  const base = liveHttpBase(liveRoomsUrl());
  try {
    const h = await f(`${base}/health`, { signal });
    if (h.status === 503) return { ok: false, why: "the worker has no LIVE_ROOMS_SECRET yet: run npx wrangler secret put LIVE_ROOMS_SECRET in workers/live-rooms" };
    if (!h.ok) return { ok: false, why: `the worker answered ${h.status} at NEXT_PUBLIC_LIVE_ROOMS_URL: check the address (wss://…workers.dev) and that it is deployed` };
    const body = JSON.stringify({ op: "ping" });
    const p = await f(`${base}/rooms/_status/server`, { method: "POST", headers: { "content-type": "application/json", [LIVE_SIG_HEADER]: await signBody(liveRoomsSecret(), body) }, body, signal });
    if (p.status === 401) return { ok: false, why: "LIVE_ROOMS_SECRET on Vercel and on the worker are different: set the same value in both" };
    return p.ok ? { ok: true } : { ok: false, why: `the worker answered ${p.status} to a signed check` };
  } catch {
    return { ok: false, why: "can't reach the worker at NEXT_PUBLIC_LIVE_ROOMS_URL: check the address and that the deploy workflow ran" };
  }
}
