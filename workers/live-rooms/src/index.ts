// The live-rooms worker (#NotesApp v0.126.0): routes /rooms/<id>/… to that room's Durable Object (src/room.ts). The object checks the
// token or the signature itself; this entry only picks the room. GET /health answers ok (for a quick check after deploying).
import type { Env } from "./cf";
export { LiveRoom } from "./room";

const ROOM_ID = /^[A-Za-z0-9_-]{1,80}$/;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response(env.LIVE_ROOMS_SECRET ? "ok" : "LIVE_ROOMS_SECRET is not set", { status: env.LIVE_ROOMS_SECRET ? 200 : 503 });
    const [, rooms, roomId] = url.pathname.split("/");
    if (rooms !== "rooms" || !roomId || !ROOM_ID.test(roomId)) return new Response("not found", { status: 404 });
    if (!env.LIVE_ROOMS_SECRET) return new Response("LIVE_ROOMS_SECRET is not set", { status: 503 });
    return env.LIVE_ROOM.get(env.LIVE_ROOM.idFromName(roomId)).fetch(req);
  },
};
