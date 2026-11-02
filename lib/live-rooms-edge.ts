import { setting } from "./config";
import { SITE_URL } from "./host";
import { LIVE_SIG_HEADER, signBody } from "./live-token";
import { liveHttpBase, type LiveConfig, type LiveServerOp } from "./live-rooms";
import type { RoomSettings } from "./rooms";

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
