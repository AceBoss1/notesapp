// Getting a call back when the network changes (owner, 3 Nov 2026: "1-on-1 calls and group calls … should use WebRTC first; if it notices
// network issues it could switch to relay if that helps"). Pure and client-safe; the browsers' side is components/calls/ice-recovery-client.ts.
//
// A call connects phone to phone first (ICE prefers a direct path and uses the TURN relay only when no direct path works). When the
// connection drops in the middle of a call (Wi-Fi to mobile data, a weak signal), one side restarts ICE: it gathers fresh paths and sends a
// new offer through the call's usual signalling, and the other side answers. In a 1:1 call the caller restarts; in a group call, of each
// pair, the person with the smaller uid. The other side only answers, so the two never offer at once.
//   1. "disconnected": wait RECOVER_WAIT_MS (it often comes back by itself), then restart. "failed": restart at once.
//   2. Each restart has ATTEMPT_MS to connect. After DIRECT_RESTARTS restarts that didn't, and only when a TURN relay is configured, one more
//      restart forces the relay (iceTransportPolicy "relay"), which gets through networks that block direct paths.
//   3. If nothing worked, the call ends GIVE_UP_MS after it dropped (under 30 seconds in all). The side that only answers waits a little
//      longer (PASSIVE_GIVE_UP_MS), so the restarting side always decides first and ends the call for both.
// Media goes through the relay only when the direct restarts failed; every ordinary restart lets ICE choose a direct path again.

export const RECOVER_WAIT_MS = 2_000;
export const ATTEMPT_MS = 8_000;
export const DIRECT_RESTARTS = 2;
export const GIVE_UP_MS = 28_000;
export const PASSIVE_GIVE_UP_MS = GIVE_UP_MS + 4_000;

export type IcePhase = "ok" | "waiting" | "restarting" | "over";
export type Recovery = {
  phase: IcePhase;
  since: number | null; // when the connection dropped
  nextAt: number | null; // when the next restart is due (or the restart in flight times out)
  restarts: number; // direct restarts so far, this drop
  relayTried: boolean; // the forced-relay restart was made, this drop
  relay: boolean; // the connection is forced through the relay now (stays until the call ends)
};
export type RecoveryAction = "none" | "restart" | "restart-relay" | "give-up" | "recovered";
export type RecoveryEvent = { type: "state"; state: RTCPeerConnectionState | string } | { type: "tick" };
export type RecoveryOpts = { drives: boolean; canRelay: boolean };

export const freshRecovery = (): Recovery => ({ phase: "ok", since: null, nextAt: null, restarts: 0, relayTried: false, relay: false });
// Whether the call screen should say "Reconnecting…".
export const isReconnecting = (r: Recovery) => r.phase === "waiting" || r.phase === "restarting";

// One step: a connection state change or a clock tick (about once a second) → the new state and what to do now.
export function stepRecovery(r: Recovery, ev: RecoveryEvent, now: number, o: RecoveryOpts): { rec: Recovery; action: RecoveryAction } {
  if (r.phase === "over") return { rec: r, action: "none" };
  if (ev.type === "state") {
    const st = ev.state;
    if (st === "connected") {
      if (r.phase === "ok") return { rec: r, action: "none" };
      return { rec: { ...freshRecovery(), relay: r.relay }, action: "recovered" };
    }
    if (st === "disconnected" || st === "failed") {
      let rec = r;
      // Just dropped: wait a moment ("disconnected" often comes back by itself), or restart at once when it "failed".
      if (r.phase === "ok") rec = { ...r, phase: "waiting", since: now, nextAt: st === "failed" ? now : now + RECOVER_WAIT_MS, restarts: 0, relayTried: false };
      // Already trying: "failed" means waiting longer won't help, so the next restart is due now.
      else if (st === "failed") rec = { ...r, nextAt: Math.min(r.nextAt ?? now, now) };
      return stepRecovery(rec, { type: "tick" }, now, o);
    }
    return { rec: r, action: "none" }; // new, connecting, checking, closed: nothing to do
  }
  // A tick.
  if (r.phase === "ok" || r.since === null) return { rec: r, action: "none" };
  const limit = o.drives ? GIVE_UP_MS : PASSIVE_GIVE_UP_MS;
  if (now - r.since >= limit) return { rec: { ...r, phase: "over", nextAt: null }, action: "give-up" };
  if (!o.drives || r.nextAt === null || now < r.nextAt) return { rec: r, action: "none" };
  if (r.restarts < DIRECT_RESTARTS) return { rec: { ...r, phase: "restarting", restarts: r.restarts + 1, nextAt: now + ATTEMPT_MS }, action: "restart" };
  if (o.canRelay && !r.relayTried) return { rec: { ...r, phase: "restarting", relayTried: true, relay: true, nextAt: now + ATTEMPT_MS }, action: "restart-relay" };
  // Nothing left to try: wait out the last attempt, then give up.
  return { rec: { ...r, nextAt: r.since + limit }, action: "none" };
}

// ── Helpers ──
// Whether the address book has a TURN relay (only then is a forced-relay restart worth trying).
export type IceServerLike = { urls: string | string[]; username?: string; credential?: string };
export const hasTurn = (ice: IceServerLike[] | null | undefined) =>
  (ice ?? []).some((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => /^turns?:/i.test(String(u))));
// Who restarts in a group call's pair: the smaller uid (both sides agree without talking).
export const restartsPair = (me: string, them: string) => me < them;

// The ICE username fragment of a description ("a=ice-ufrag:abcd"), which changes with every restart. A connection candidate from the
// other side carries the fragment of the description it belongs to: one sent for a new offer can arrive before that offer does, so it waits.
export function iceUfrag(sdp: string | null | undefined): string | null {
  const m = /^a=ice-ufrag:(\S+)\s*$/m.exec(sdp ?? "");
  return m ? m[1] : null;
}
// Add it now (it matches the description we have, or says nothing about which one it's for), or keep it for the next description.
export const candidateFits = (c: { usernameFragment?: string | null }, remoteSdp: string | null | undefined) =>
  !c.usernameFragment || !remoteSdp || iceUfrag(remoteSdp) === null || c.usernameFragment === iceUfrag(remoteSdp);

// The restart offer and its answer travel in the call's own signalling doc (calls/{id}, or the pair's groupCalls/{id}/links/{linkId}):
// n counts the restarts of this connection, so an answer to an older offer is ignored.
export type IceRestartOffer = { n: number; by: string; offer: { type: string; sdp: string }; relay?: boolean };
export type IceRestartAnswer = { n: number; answer: { type: string; sdp: string } };
// The answering side: a restart offer from the other person it hasn't answered yet.
export const restartToAnswer = (r: IceRestartOffer | undefined | null, me: string, answered: number) => !!r && r.by !== me && r.n > answered && !!r.offer?.sdp;
// The restarting side: the answer to the restart it's waiting for.
export const answerFits = (a: IceRestartAnswer | undefined | null, waitingFor: number) => !!a && waitingFor > 0 && a.n === waitingFor && !!a.answer?.sdp;
// After a restart the encryption certificates are the same, so the safety code should be too; if it isn't, the screen shows the new one
// and asks both people to compare again.
export const codeChanged = (before: string, after: string) => !!before && !!after && before !== after;
