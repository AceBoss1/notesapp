// In-memory stand-ins for the bits of the Cloudflare Workers runtime that LiveRoom uses (workers/live-rooms/src/cf.ts): hibernatable
// sockets with tags and attachments, storage with an alarm. Shared by tests/live-rooms/room.test.ts and live.emulator.ts.
import assert from "node:assert/strict";
import type { CfDurableObjectState, CfStorage, CfWebSocket } from "../../workers/live-rooms/src/cf";
import type { LiveServerMsg } from "../../lib/live-rooms";

export class FakeWS implements CfWebSocket {
  sent: LiveServerMsg[] = []; closed: { code?: number; reason?: string } | null = null; tags: string[] = []; private att: string | null = null;
    send(s: string) { if (this.closed) throw new Error("closed"); this.sent.push(JSON.parse(s)); }
  close(code?: number, reason?: string) { if (!this.closed) { this.closed = { code, reason }; } }
  serializeAttachment(v: unknown) { const s = JSON.stringify(v); assert.ok(s.length <= 2048, "attachments stay under 2 KB"); this.att = s; }
  deserializeAttachment() { return this.att ? JSON.parse(this.att) : null; }
  last<K extends LiveServerMsg["t"]>(t: K) { return [...this.sent].reverse().find((m) => m.t === t) as Extract<LiveServerMsg, { t: K }> | undefined; }
  all<K extends LiveServerMsg["t"]>(t: K) { return this.sent.filter((m) => m.t === t) as Extract<LiveServerMsg, { t: K }>[]; }
}
export class FakeStorage implements CfStorage {
  map = new Map<string, string>(); alarm: number | null = null;
  async get<T>(k: string) { const v = this.map.get(k); return v === undefined ? undefined : (JSON.parse(v) as T); }
  async put<T>(k: string, v: T) { this.map.set(k, JSON.stringify(v)); }
  async delete(k: string) { return this.map.delete(k); }
  async deleteAll() { this.map.clear(); }
  async getAlarm() { return this.alarm; }
  async setAlarm(t: number) { this.alarm = t; }
  async deleteAlarm() { this.alarm = null; }
}
export class FakeState implements CfDurableObjectState {
  storage = new FakeStorage(); sockets: FakeWS[] = [];
  acceptWebSocket(ws: CfWebSocket, tags: string[] = []) { (ws as FakeWS).tags = tags; this.sockets.push(ws as FakeWS); }
  getWebSockets(tag?: string) { return this.sockets.filter((w) => !w.closed && (!tag || w.tags.includes(tag))); }
}

