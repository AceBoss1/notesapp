import { setting } from "@/lib/config";

// The Cloudflare Realtime relay (Serverless SFU, once called "Calls") for audio rooms (lib/rooms.ts, mode "relay"). Server-only: the app
// token never reaches a browser. Browsers send their offers and answers to /api/community/rooms, which checks who may send or receive
// (lib/rooms-server.ts) and calls Cloudflare through this client.
//
// Cloudflare's HTTPS API (developers.cloudflare.com/realtime/sfu/https-api, OpenAPI realtime-api-2024-05-21):
//   base https://rtc.live.cloudflare.com/v1/apps/{CLOUDFLARE_REALTIME_APP_ID}, header Authorization: Bearer {CLOUDFLARE_REALTIME_APP_TOKEN}
//   POST sessions/new                    → { sessionId }                     (one session = one RTCPeerConnection in one browser)
//   POST sessions/{id}/tracks/new        { sessionDescription: offer, tracks: [{ location: "local", mid, trackName }] } → { sessionDescription: answer }
//                                        { tracks: [{ location: "remote", sessionId, trackName }] } → { requiresImmediateRenegotiation, sessionDescription: offer, tracks: [{ mid, trackName }] }
//   PUT  sessions/{id}/renegotiate       { sessionDescription: answer }
//   PUT  sessions/{id}/tracks/close      { tracks: [{ mid }], force: true }  (stops the media without an SDP exchange)
// Errors come back as errorCode / errorDescription, at the top and per track.

export const relayConfigured = () => !!((setting("CLOUDFLARE_REALTIME_APP_ID") || "").trim() && (setting("CLOUDFLARE_REALTIME_APP_TOKEN") || "").trim());

export type Sdp = { type: "offer" | "answer"; sdp: string };
export type RelayTrack = { location: "local" | "remote"; mid?: string; trackName: string; sessionId?: string; errorCode?: string; errorDescription?: string };

// why: plain words for the host, /status and the logs; never the token.
export class RelayError extends Error {
  constructor(public why: string, public status = 502) { super(why); }
}

export type RelayClient = {
  newSession(signal?: AbortSignal): Promise<string>;
  push(sessionId: string, offer: Sdp, tracks: { mid: string; trackName: string }[]): Promise<{ answer: Sdp; tracks: RelayTrack[] }>;
  pull(sessionId: string, tracks: { sessionId: string; trackName: string }[]): Promise<{ offer: Sdp | null; renegotiate: boolean; tracks: RelayTrack[] }>;
  renegotiate(sessionId: string, answer: Sdp): Promise<void>;
  close(sessionId: string, mids: string[]): Promise<void>;
};

const isSdp = (x: unknown): x is Sdp => !!x && typeof x === "object" && ((x as Sdp).type === "offer" || (x as Sdp).type === "answer") && typeof (x as Sdp).sdp === "string";
export const cleanSdp = (x: unknown, type: Sdp["type"]): Sdp | null => (isSdp(x) && x.type === type && x.sdp.length > 0 && x.sdp.length < 100_000 ? { type, sdp: x.sdp } : null);

// Turns Cloudflare's answer into a RelayError the owner can act on, like the TURN messages in lib/calls-server.ts.
export function relayWhy(status: number, j: { errorCode?: string; errorDescription?: string } | null, path: string): string {
  const msg = `${j?.errorCode ?? ""} ${j?.errorDescription ?? ""}`.toLowerCase();
  if (status === 401 || status === 403 || msg.includes("unauthor") || msg.includes("forbidden")) return "Cloudflare refused the token: CLOUDFLARE_REALTIME_APP_TOKEN must be the App Token (secret) of that same Realtime SFU application";
  if ((status === 404 || (msg.includes("app") && msg.includes("not found"))) && path.startsWith("sessions/new")) return "Cloudflare can't find that app: CLOUDFLARE_REALTIME_APP_ID must be the App ID from Realtime → Serverless SFU";
  if (status === 404 || (msg.includes("session") && msg.includes("not found"))) return "Cloudflare no longer has that session (it may have expired): leave the room and join again";
  if (status === 429) return "Cloudflare is limiting us for a moment (too many requests)";
  if (status >= 500) return "Cloudflare's Realtime service is having trouble";
  if (j?.errorDescription || j?.errorCode) return `Cloudflare said: ${String(j.errorDescription || j.errorCode).slice(0, 160)}`;
  return `Cloudflare answered ${status}`;
}

export function relayClient(fetcher: typeof fetch = fetch): RelayClient {
  const appId = (setting("CLOUDFLARE_REALTIME_APP_ID") || "").trim(), token = (setting("CLOUDFLARE_REALTIME_APP_TOKEN") || "").trim();
  const call = async <T,>(method: "POST" | "PUT", path: string, body?: unknown, signal?: AbortSignal): Promise<T> => {
    if (!appId || !token) throw new RelayError("The relay isn't set up: add CLOUDFLARE_REALTIME_APP_ID and CLOUDFLARE_REALTIME_APP_TOKEN", 503);
    let r: Response;
    try {
      r = await fetcher(`https://rtc.live.cloudflare.com/v1/apps/${encodeURIComponent(appId)}/${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: signal ?? AbortSignal.timeout(8000), cache: "no-store",
      });
    } catch {
      throw new RelayError("could not reach Cloudflare in time", 504);
    }
    const j = (await r.json().catch(() => null)) as (T & { errorCode?: string; errorDescription?: string }) | null;
    if (!r.ok || !j || j.errorCode) throw new RelayError(relayWhy(r.status, j, path), r.status === 401 || r.status === 403 ? 502 : r.status >= 500 || !r.ok ? 502 : 409);
    return j;
  };
  const sid = (s: string) => encodeURIComponent(s);
  return {
    async newSession(signal) {
      const j = await call<{ sessionId?: string }>("POST", "sessions/new", undefined, signal);
      if (!j.sessionId) throw new RelayError("Cloudflare didn't give us a session");
      return j.sessionId;
    },
    async push(sessionId, offer, tracks) {
      const j = await call<{ sessionDescription?: unknown; tracks?: RelayTrack[] }>("POST", `sessions/${sid(sessionId)}/tracks/new`, { sessionDescription: offer, tracks: tracks.map((t) => ({ location: "local", mid: t.mid, trackName: t.trackName })) });
      const answer = cleanSdp(j.sessionDescription, "answer");
      const bad = (j.tracks ?? []).find((t) => t.errorCode);
      if (bad) throw new RelayError(relayWhy(200, bad, "tracks/new"), 409);
      if (!answer) throw new RelayError("Cloudflare didn't answer the microphone's offer");
      return { answer, tracks: j.tracks ?? [] };
    },
    async pull(sessionId, tracks) {
      const j = await call<{ sessionDescription?: unknown; requiresImmediateRenegotiation?: boolean; tracks?: RelayTrack[] }>("POST", `sessions/${sid(sessionId)}/tracks/new`, { tracks: tracks.map((t) => ({ location: "remote", sessionId: t.sessionId, trackName: t.trackName })) });
      return { offer: cleanSdp(j.sessionDescription, "offer"), renegotiate: !!j.requiresImmediateRenegotiation, tracks: j.tracks ?? [] };
    },
    async renegotiate(sessionId, answer) {
      await call("PUT", `sessions/${sid(sessionId)}/renegotiate`, { sessionDescription: answer });
    },
    async close(sessionId, mids) {
      if (!mids.length) return;
      await call("PUT", `sessions/${sid(sessionId)}/tracks/close`, { tracks: mids.map((mid) => ({ mid })), force: true });
    },
  };
}

// For /status: proves the app id, the token and the network by opening a session (free: Cloudflare bills only media, and a session
// nobody connects to expires by itself). why says what to fix; it never shows the token.
export async function relayCheck(fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<{ ok: boolean; why?: string }> {
  if (!relayConfigured()) return { ok: false, why: "not set up" };
  try {
    await relayClient(fetcher).newSession(signal);
    return { ok: true };
  } catch (e) {
    return { ok: false, why: e instanceof RelayError ? e.why : "could not reach Cloudflare in time" };
  }
}
