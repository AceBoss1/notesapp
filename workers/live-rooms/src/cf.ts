// The few Cloudflare Workers runtime shapes this worker uses, declared here instead of installing @cloudflare/workers-types (the worker
// builds with wrangler, which needs no types, and the tests run in Node against in-memory stand-ins of exactly these shapes).
// Docs: developers.cloudflare.com/durable-objects/best-practices/websockets/ (the WebSocket Hibernation API).

// A server-side WebSocket in a Durable Object. With the Hibernation API the object may be evicted between messages; whatever a socket
// needs to remember goes in its attachment (up to 2 KB), which survives.
export interface CfWebSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}
export interface CfStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteAll(): Promise<void>;
  getAlarm(): Promise<number | null>;
  setAlarm(scheduledTime: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}
export interface CfDurableObjectState {
  storage: CfStorage;
  // Hibernation API: the runtime keeps the socket, and calls webSocketMessage / webSocketClose on the object (waking it if needed).
  acceptWebSocket(ws: CfWebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): CfWebSocket[];
  // Answers a fixed request (our "ping") without waking the object.
  setWebSocketAutoResponse?(pair: unknown): void;
}
export interface CfDurableObjectStub { fetch(req: Request): Promise<Response> }
export interface CfDurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): CfDurableObjectStub;
}
export interface Env {
  LIVE_ROOM: CfDurableObjectNamespace;
  LIVE_ROOMS_SECRET: string; // wrangler secret put LIVE_ROOMS_SECRET (the same value as the site's LIVE_ROOMS_SECRET)
}
