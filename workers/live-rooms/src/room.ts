// LiveRoom: one Durable Object per audio room (lib/live-rooms.ts explains why). It holds every socket in the room through the WebSocket
// Hibernation API (state.acceptWebSocket), so a quiet room costs nothing between messages, and:
// - broadcasts the chat, with slow mode for listeners (automatic past the room's setting, or the host's switch), a rate limit per
//   connection and a size limit per frame; host and moderators remove messages, mute and ban for the room;
// - broadcasts raised hands, stage moves (pushed by our server, never taken from a browser) and the stage's video on/off;
// - counts the listeners connected now (distinct people) and broadcasts it at most every 2 s;
// - sends the chat, removals, bans, raised hands, each person's connected time (sessions) and the count to our server in signed batches
//   (config.callback), for the record in Firestore; camera on/off comes from our server (it decides), and is only broadcast here.
// Everything that must survive hibernation is in storage or in each socket's attachment; nothing important lives only in memory.
import { LIVE_SIG_HEADER, signBody, verifyBody, verifyLiveToken, type LiveRole } from "../../../lib/live-token";
import {
  LIVE_BATCH_MS, LIVE_SESSIONS_BATCH, LIVE_SESSIONS_MAX, LIVE_CHAT_RATE, LIVE_COUNT_BROADCAST_MS, LIVE_COUNT_KEEPALIVE_MS, LIVE_COUNT_PUSH_MS, LIVE_FRAME_MAX, LIVE_PENDING_MAX, LIVE_RECENT, LIVE_SIGNAL_RATE,
  batchDue, cleanLiveText, countPushDue, isLiveChatId, liveChatId, liveSlow, liveWait, retryDelay, take,
  type Bucket, type LiveBatch, type LiveChat, type LiveClientMsg, type LiveConfig, type LiveHand, type LiveSession, type LiveServerMsg, type LiveServerOp,
} from "../../../lib/live-rooms";
import type { CfDurableObjectState, CfWebSocket, Env } from "./cf";

// What each socket remembers (its attachment): who it is, and its rate-limit buckets.
export type Attachment = { u: string; role: LiveRole; n: string; a: string; mod: boolean; chat?: Bucket; sig?: Bucket; last?: number };
// The room's state in storage under "meta"; each message waiting for our server is under "p:<id>", the last LIVE_RECENT under "recent".
export type Meta = {
  config: LiveConfig | null; ended: boolean; hostSlow: boolean | null;
  hands: Record<string, LiveHand>; video: Record<string, boolean>; roles: Record<string, LiveRole>;
  muted: string[]; banned: string[]; bansOut: string[]; removed: string[]; pendingIds: string[]; oldestPending?: number;
  pushed?: { at: number; n: number }; peak: number; fails: number; retryAt?: number;
  countAt: number; countSent: number; // the count last broadcast to the sockets, and when
  // Someone connected, left or changed role since the last count; and how many people were connected at the last count. Messages
  // never walk every socket (a 10,000 room): only the alarm counts, at most every LIVE_COUNT_BROADCAST_MS.
  countDirty: boolean; connected: number;
  // For our server: raised hands' changes since the last batch (uid → the hand, or null for down), and how many session events wait
  // (the events themselves are under "sess"; each person's open session is marked under "o:<uid>").
  handsOut: Record<string, LiveHand | null>; sessCount: number;
};
const META0: Meta = { config: null, ended: false, hostSlow: null, hands: {}, video: {}, roles: {}, muted: [], banned: [], bansOut: [], removed: [], pendingIds: [], peak: 0, fails: 0, countAt: 0, countSent: -1, countDirty: false, connected: 0, handsOut: {}, sessCount: 0 };
const HANDS_MAX = 500;
const ROOM_ID = /^[A-Za-z0-9_-]{1,80}$/;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export class LiveRoom {
  private meta: Meta | null = null;
  private recent: LiveChat[] | null = null;
  // Overridable in tests: the clock, randomness, the outbound fetch, and the WebSocket upgrade (WebSocketPair and a 101 Response exist
  // only in the Workers runtime).
  now = () => Date.now();
  rand = () => Math.random().toString(36).slice(2, 10);
  post: (url: string, init: RequestInit) => Promise<Response> = (url, init) => fetch(url, init);
  upgrade: () => { client: unknown; server: CfWebSocket; response: () => Response } = () => {
    const pair = new (globalThis as unknown as { WebSocketPair: new () => Record<0 | 1, CfWebSocket> }).WebSocketPair();
    return { client: pair[0], server: pair[1], response: () => new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit) };
  };

  constructor(private state: CfDurableObjectState, private env: Env) {
    // Browsers send "ping" every 30 s to keep the socket open; the runtime answers "pong" without waking (or billing) the room.
    const Pair = (globalThis as unknown as { WebSocketRequestResponsePair?: new (req: string, res: string) => unknown }).WebSocketRequestResponsePair;
    if (Pair && state.setWebSocketAutoResponse) state.setWebSocketAutoResponse(new Pair("ping", "pong"));
  }

  // ── storage ──
  private async load(): Promise<Meta> {
    if (!this.meta) this.meta = { ...META0, ...((await this.state.storage.get<Meta>("meta")) ?? {}) };
    return this.meta;
  }
  private async loadRecent(): Promise<LiveChat[]> {
    if (!this.recent) this.recent = (await this.state.storage.get<LiveChat[]>("recent")) ?? [];
    return this.recent;
  }
  private save() { return this.state.storage.put("meta", this.meta); }

  // ── sockets ──
  private sockets() {
    return this.state.getWebSockets().flatMap((ws) => {
      const a = ws.deserializeAttachment() as Attachment | null;
      return a ? [{ ws, a }] : [];
    });
  }
  private send(ws: CfWebSocket, m: LiveServerMsg) { try { ws.send(JSON.stringify(m)); } catch { /* closing */ } }
  private broadcast(m: LiveServerMsg) {
    const s = JSON.stringify(m);
    for (const ws of this.state.getWebSockets()) { try { ws.send(s); } catch { /* closing */ } }
  }
  // Listeners connected now, counted once each however many tabs; and everyone (for the peak).
  counts() {
    const listeners = new Set<string>(), all = new Set<string>();
    for (const { a } of this.sockets()) { all.add(a.u); if (a.role === "listener") listeners.add(a.u); }
    return { listeners: listeners.size, all: all.size };
  }
  // Slow mode from the last count (at most LIVE_COUNT_BROADCAST_MS old), never by walking the sockets on each message.
  private slowNow(m: Meta) { return liveSlow(Math.max(0, m.countSent), m.config, m.hostSlow); }

  // ── HTTP: the socket (browsers) and the server channel (our server, signed) ──
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const [, rooms, roomId, what] = url.pathname.split("/");
    if (rooms !== "rooms" || !roomId || !ROOM_ID.test(roomId)) return json(404, { error: "not found" });
    if (what === "ws") return this.connect(req, roomId, url.searchParams.get("t"));
    if (what === "server" && req.method === "POST") return this.fromServer(req, roomId);
    return json(404, { error: "not found" });
  }

  private async connect(req: Request, roomId: string, token: string | null): Promise<Response> {
    if ((req.headers.get("upgrade") ?? "").toLowerCase() !== "websocket") return json(426, { error: "expected a WebSocket" });
    const claims = await verifyLiveToken(this.env.LIVE_ROOMS_SECRET, token, this.now());
    if (!claims || claims.r !== roomId) return json(401, { error: "bad or expired token" });
    const m = await this.load();
    if (m.ended) return json(410, { error: "the room has ended" });
    if (m.banned.includes(claims.u)) return json(403, { error: "removed from this room" });
    const { server, response } = this.upgrade();
    // The stage as our server last told us beats the role in an older token.
    const role = m.roles[claims.u] ?? claims.role;
    const att: Attachment = { u: claims.u, role, n: claims.n, a: claims.a, mod: claims.mod };
    await this.sessionIn(m, claims.u, role);
    this.state.acceptWebSocket(server, [claims.u]);
    server.serializeAttachment(att);
    m.countDirty = true;
    const recent = (await this.loadRecent()).filter((x) => !m.removed.includes(x.id));
    this.send(server, { t: "hello", you: { uid: claims.u, role, mod: claims.mod, muted: m.muted.includes(claims.u) }, ...(claims.mod || role === "host" ? { mutedList: m.muted } : {}), count: Math.max(0, m.countSent), hands: m.hands, video: m.video, recent, slow: this.slowNow(m), hostSlow: m.hostSlow });
    await this.save();
    await this.schedule();
    return response();
  }

  private async fromServer(req: Request, roomId: string): Promise<Response> {
    const body = await req.text();
    if (body.length > 64_000 || !(await verifyBody(this.env.LIVE_ROOMS_SECRET, body, req.headers.get(LIVE_SIG_HEADER), this.now()))) return json(401, { error: "bad signature" });
    let op: LiveServerOp;
    try { op = JSON.parse(body) as LiveServerOp; } catch { return json(400, { error: "bad body" }); }
    if (op.op === "ping") return json(200, { ok: true });
    const m = await this.load();
    switch (op.op) {
      case "config": {
        if (!op.config || op.config.roomId !== roomId) return json(400, { error: "wrong room" });
        m.config = op.config;
        m.ended = false;
        this.broadcast({ t: "slow", slow: this.slowNow(m), hostSlow: m.hostSlow });
        break;
      }
      case "role": {
        if (!op.uid || !["host", "speaker", "listener"].includes(op.role)) return json(400, { error: "bad role" });
        m.roles[op.uid] = op.role;
        m.countDirty = true;
        for (const ws of this.state.getWebSockets(op.uid)) {
          const a = ws.deserializeAttachment() as Attachment;
          ws.serializeAttachment({ ...a, role: op.role });
        }
        if (op.role !== "listener" && m.hands[op.uid]) this.handDown(m, op.uid);
        this.broadcast({ t: "stage", uid: op.uid, role: op.role });
        break;
      }
      case "chat": {
        // Sent through our server (someone on the Firestore fallback): already in Firestore, so only broadcast it.
        if (!op.m || !isLiveChatId(op.m.id)) return json(400, { error: "bad message" });
        await this.remember(op.m);
        this.broadcast({ t: "chat", m: op.m });
        break;
      }
      case "video": {
        if (!op.uid) return json(400, { error: "bad uid" });
        if (op.on === true) m.video[op.uid] = true; else delete m.video[op.uid];
        this.broadcast({ t: "video", uid: op.uid, on: op.on === true });
        break;
      }
      case "unchat": {
        if (!isLiveChatId(op.id)) return json(400, { error: "bad id" });
        await this.drop(m, op.id, false);
        break;
      }
      case "end": {
        await this.end(m);
        return json(200, { ok: true });
      }
      default: return json(400, { error: "unknown op" });
    }
    await this.save();
    await this.schedule();
    return json(200, { ok: true });
  }

  // ── messages from browsers ──
  async webSocketMessage(ws: CfWebSocket, raw: string | ArrayBuffer): Promise<void> {
    const size = typeof raw === "string" ? raw.length : raw.byteLength;
    if (typeof raw !== "string" || size > LIVE_FRAME_MAX) { this.send(ws, { t: "err", msg: "That message is too big." }); return; }
    let msg: LiveClientMsg;
    try { msg = JSON.parse(raw) as LiveClientMsg; } catch { return; }
    const a = ws.deserializeAttachment() as Attachment | null;
    if (!a || !msg || typeof msg !== "object") return;
    const m = await this.load();
    if (m.ended) { this.send(ws, { t: "ended" }); return; }
    const now = this.now();
    const staff = a.role === "host" || a.mod;
    switch (msg.t) {
      case "ping": this.send(ws, { t: "pong" }); return;
      case "chat": {
        const nonce = typeof msg.nonce === "string" ? msg.nonce.slice(0, 40) : undefined;
        const text = cleanLiveText(msg.text);
        if (!text) return;
        if (m.muted.includes(a.u)) { this.send(ws, { t: "err", msg: "The host has muted you in this room's chat.", nonce }); return; }
        const wait = liveWait(a.role, a.last, this.slowNow(m), now);
        if (wait > 0) { this.send(ws, { t: "err", msg: `Slow mode is on in this big room: you can send again in ${wait} second${wait === 1 ? "" : "s"}.`, nonce, wait }); return; }
        const r = take(a.chat, LIVE_CHAT_RATE, now);
        if (!r.ok) { ws.serializeAttachment({ ...a, chat: r.bucket }); this.send(ws, { t: "err", msg: "You're sending fast: wait a moment.", nonce }); return; }
        ws.serializeAttachment({ ...a, chat: r.bucket, last: now });
        const item: LiveChat = { id: liveChatId(now, this.rand()), from: a.u, name: a.n, avatar: a.a, text, at: new Date(now).toISOString() };
        this.broadcast({ t: "chat", m: item });
        await this.remember(item);
        await this.state.storage.put(`p:${item.id}`, item);
        m.pendingIds.push(item.id);
        m.oldestPending ??= now;
        if (m.pendingIds.length > LIVE_PENDING_MAX) {
          const gone = m.pendingIds.splice(0, m.pendingIds.length - LIVE_PENDING_MAX);
          for (const id of gone) await this.state.storage.delete(`p:${id}`);
        }
        break;
      }
      case "hand": {
        if (!this.signal(ws, a, now)) return;
        if (msg.up === true && a.role === "listener") {
          if (Object.keys(m.hands).length >= HANDS_MAX && !m.hands[a.u]) { this.send(ws, { t: "err", msg: "Lots of hands are up already: try again in a moment." }); return; }
          const h: LiveHand = { name: a.n, avatar: a.a, at: new Date(now).toISOString() };
          m.hands[a.u] = h; m.handsOut[a.u] = h; m.oldestPending ??= now;
          this.broadcast({ t: "hand", uid: a.u, up: true, ...h });
        } else if (msg.up === false && m.hands[a.u]) {
          this.handDown(m, a.u);
        } else return;
        break;
      }
      case "del": {
        if (!staff || !isLiveChatId(msg.id)) return;
        await this.drop(m, msg.id, true);
        break;
      }
      case "mute": {
        if (!staff || typeof msg.uid !== "string" || !msg.uid || msg.uid === m.config?.hostUid || msg.uid === a.u) return;
        m.muted = m.muted.filter((u) => u !== msg.uid);
        if (msg.on === true) m.muted.push(msg.uid);
        this.broadcast({ t: "muted", uid: msg.uid, on: msg.on === true });
        break;
      }
      case "ban": {
        if (!staff || typeof msg.uid !== "string" || !msg.uid || msg.uid === m.config?.hostUid || msg.uid === a.u) return;
        if (!m.banned.includes(msg.uid)) { m.banned.push(msg.uid); m.bansOut.push(msg.uid); m.oldestPending ??= now; }
        m.countDirty = true;
        if (m.hands[msg.uid]) this.handDown(m, msg.uid);
        for (const s of this.state.getWebSockets(msg.uid)) { this.send(s, { t: "err", msg: "You've been removed from this room." }); try { s.close(4003, "removed"); } catch { /* gone */ } }
        await this.sessionOut(m, msg.uid);
        break;
      }
      case "slow": {
        if (a.role !== "host") return;
        m.hostSlow = msg.on === true ? true : msg.on === false ? false : null;
        this.broadcast({ t: "slow", slow: this.slowNow(m), hostSlow: m.hostSlow });
        break;
      }
      default: return;
    }
    await this.save();
    await this.schedule();
  }

  async webSocketClose(ws: CfWebSocket): Promise<void> {
    try { ws.close(1000, "bye"); } catch { /* already closed */ }
    const a = ws.deserializeAttachment() as Attachment | null;
    const m = await this.load();
    m.countDirty = true;
    // Their last tab gone: their session ends, and their hand goes down (a hand from someone not here can't be brought up).
    if (a && !this.state.getWebSockets(a.u).some((s) => s !== ws)) {
      if (m.hands[a.u]) this.handDown(m, a.u);
      await this.sessionOut(m, a.u);
    }
    await this.save();
    await this.schedule();
  }
  async webSocketError(ws: CfWebSocket): Promise<void> { return this.webSocketClose(ws); }

  private signal(ws: CfWebSocket, a: Attachment, now: number): boolean {
    const r = take(a.sig, LIVE_SIGNAL_RATE, now);
    ws.serializeAttachment({ ...a, sig: r.bucket });
    if (!r.ok) this.send(ws, { t: "err", msg: "Slow down a little." });
    return r.ok;
  }
  private handDown(m: Meta, uid: string) {
    delete m.hands[uid]; m.handsOut[uid] = null; m.oldestPending ??= this.now();
    this.broadcast({ t: "hand", uid, up: false });
  }
  // Sessions: "in" when someone's first tab connects, "out" when their last closes (or they're removed, or the room ends). The open mark
  // under "o:<uid>" keeps a second tab or a repeated close from counting twice.
  private async sessionIn(m: Meta, uid: string, role: LiveRole) {
    if (await this.state.storage.get(`o:${uid}`)) return;
    const at = this.now();
    await this.state.storage.put(`o:${uid}`, { at, role });
    await this.addSession(m, { u: uid, e: "in", at, role });
  }
  private async sessionOut(m: Meta, uid: string) {
    const open = await this.state.storage.get<{ at: number; role: LiveRole }>(`o:${uid}`);
    if (!open) return;
    await this.state.storage.delete(`o:${uid}`);
    await this.addSession(m, { u: uid, e: "out", at: this.now(), role: open.role });
  }
  private async addSession(m: Meta, ev: LiveSession) {
    const list = (await this.state.storage.get<LiveSession[]>("sess")) ?? [];
    list.push(ev);
    if (list.length > LIVE_SESSIONS_MAX) list.splice(0, list.length - LIVE_SESSIONS_MAX);
    await this.state.storage.put("sess", list);
    m.sessCount = list.length;
    m.oldestPending ??= ev.at;
  }
  private outstanding(m: Meta) { return m.pendingIds.length > 0 || m.removed.length > 0 || m.bansOut.length > 0 || m.sessCount > 0 || Object.keys(m.handsOut).length > 0; }

  private async remember(item: LiveChat) {
    const recent = await this.loadRecent();
    recent.push(item);
    if (recent.length > LIVE_RECENT) recent.splice(0, recent.length - LIVE_RECENT);
    await this.state.storage.put("recent", recent);
  }
  // A removal: gone from every screen at once; our server deletes it from Firestore with the next batch (report = true).
  private async drop(m: Meta, id: string, report: boolean) {
    this.broadcast({ t: "del", id });
    const recent = await this.loadRecent();
    const i = recent.findIndex((x) => x.id === id);
    if (i >= 0) { recent.splice(i, 1); await this.state.storage.put("recent", recent); }
    if (m.pendingIds.includes(id)) { m.pendingIds = m.pendingIds.filter((x) => x !== id); await this.state.storage.delete(`p:${id}`); }
    if (report && !m.removed.includes(id)) { m.removed.push(id); m.oldestPending ??= this.now(); }
    if (!this.outstanding(m)) m.oldestPending = undefined;
  }

  // ── the alarm: batches to our server, the count to our server and to the sockets ──
  private async schedule() {
    const m = await this.load();
    if (m.ended) return;
    const now = this.now();
    const times: number[] = [];
    if (m.countDirty) times.push(m.countAt + LIVE_COUNT_BROADCAST_MS);
    // To our server only once it has told us where (config), and never before a failed send's wait is over.
    if (m.config?.callback) {
      const gate = (t: number) => Math.max(t, m.retryAt ?? 0);
      if (this.outstanding(m)) times.push(gate((m.oldestPending ?? now) + (m.pendingIds.length >= 50 || m.sessCount >= LIVE_SESSIONS_BATCH ? -LIVE_BATCH_MS : 0) + LIVE_BATCH_MS));
      if (m.connected > 0 || m.pushed?.n) times.push(gate((m.pushed?.at ?? 0) + (m.pushed && m.pushed.n === m.countSent ? LIVE_COUNT_KEEPALIVE_MS : LIVE_COUNT_PUSH_MS)));
    }
    if (!times.length) return;
    const at = Math.max(now, Math.min(...times));
    const cur = await this.state.storage.getAlarm();
    if (cur === null || cur > at || cur < now) await this.state.storage.setAlarm(at);
  }

  async alarm(): Promise<void> {
    const m = await this.load();
    if (m.ended) return;
    const now = this.now();
    // The one place that walks every socket, at most every LIVE_COUNT_BROADCAST_MS.
    const { listeners, all } = m.countDirty && now - m.countAt >= LIVE_COUNT_BROADCAST_MS ? this.counts() : { listeners: Math.max(0, m.countSent), all: m.connected };
    m.peak = Math.max(m.peak, all);
    if (m.countDirty && now - m.countAt >= LIVE_COUNT_BROADCAST_MS) {
      m.countDirty = false; m.connected = all;
      if (listeners !== m.countSent) this.broadcast({ t: "count", n: listeners });
      // Slow mode follows the count: tell the room when it switches.
      const before = liveSlow(m.countSent < 0 ? 0 : m.countSent, m.config, m.hostSlow), after = liveSlow(listeners, m.config, m.hostSlow);
      if (before !== after) this.broadcast({ t: "slow", slow: after, hostSlow: m.hostSlow });
      m.countSent = listeners; m.countAt = now;
    }
    const waiting = m.retryAt !== undefined && now < m.retryAt; // our server failed: nothing goes until the wait is over
    const chatDue = this.outstanding(m) && !waiting && (batchDue(m.pendingIds.length, m.oldestPending, now) || m.sessCount >= LIVE_SESSIONS_BATCH || (m.oldestPending !== undefined && now - m.oldestPending >= LIVE_BATCH_MS));
    const countDue = !waiting && countPushDue(m.pushed, listeners, now) && (m.connected > 0 || (m.pushed?.n ?? 0) > 0);
    if (chatDue || countDue) await this.flush(m, countDue ? listeners : undefined, false);
    await this.save();
    await this.schedule();
  }

  // One signed batch to our server. On failure everything stays for the next try, with a growing wait.
  async flush(m: Meta, count: number | undefined, final: boolean): Promise<boolean> {
    if (!m.config?.callback) return false;
    const now = this.now();
    const ids = m.pendingIds.slice(0, 50);
    const chat: LiveChat[] = [];
    for (const id of ids) { const c = await this.state.storage.get<LiveChat>(`p:${id}`); if (c) chat.push(c); }
    const sess = ((await this.state.storage.get<LiveSession[]>("sess")) ?? []).slice(0, LIVE_SESSIONS_BATCH);
    const hands = { ...m.handsOut };
    const batch: LiveBatch = {
      roomId: m.config.roomId, chat, removed: m.removed.slice(0, 200), banned: m.bansOut.slice(0, 200),
      ...(sess.length ? { sessions: sess } : {}), ...(Object.keys(hands).length ? { hands } : {}),
      ...(count !== undefined ? { count, peak: m.peak } : {}), ...(final ? { final: true, peak: m.peak } : {}),
    };
    const body = JSON.stringify(batch);
    let ok = false;
    try {
      const res = await this.post(m.config.callback, { method: "POST", headers: { "content-type": "application/json", [LIVE_SIG_HEADER]: await signBody(this.env.LIVE_ROOMS_SECRET, body, now) }, body });
      ok = res.ok;
    } catch { ok = false; }
    if (!ok) { m.fails += 1; m.retryAt = now + retryDelay(m.fails); return false; }
    m.fails = 0; m.retryAt = undefined;
    for (const id of ids) await this.state.storage.delete(`p:${id}`);
    m.pendingIds = m.pendingIds.slice(ids.length);
    if (sess.length) {
      const rest = ((await this.state.storage.get<LiveSession[]>("sess")) ?? []).slice(sess.length);
      await this.state.storage.put("sess", rest);
      m.sessCount = rest.length;
    }
    for (const [u, h] of Object.entries(hands)) if (m.handsOut[u] === h) delete m.handsOut[u];
    m.removed = m.removed.slice(batch.removed.length);
    m.bansOut = m.bansOut.slice(batch.banned.length);
    if (count !== undefined) m.pushed = { at: now, n: count };
    m.oldestPending = this.outstanding(m) ? now : undefined;
    return true;
  }

  // The room ended (our server says so): everyone is told and disconnected, the last batch and the peak go to our server, and the room's
  // storage is cleared, keeping only "ended" so old tokens can't reconnect.
  private async end(m: Meta) {
    m.peak = Math.max(m.peak, this.counts().all);
    // Everyone still here: their session ends now (our server also closes any it still has open when the final batch arrives).
    for (const u of new Set(this.sockets().map((x) => x.a.u))) await this.sessionOut(m, u);
    m.ended = true;
    this.broadcast({ t: "ended" });
    for (const ws of this.state.getWebSockets()) { try { ws.close(4000, "ended"); } catch { /* gone */ } }
    for (let i = 0; i < 20 && (this.outstanding(m) || i === 0); i++) if (!(await this.flush(m, 0, true))) break;
    await this.state.storage.deleteAlarm();
    await this.state.storage.deleteAll();
    this.meta = { ...META0, ended: true, config: m.config, peak: m.peak };
    this.recent = [];
    await this.save();
  }
}
