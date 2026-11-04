"use client";

import {
  answerFits, candidateFits, freshRecovery, isReconnecting, restartToAnswer, stepRecovery,
  type IceRestartAnswer, type IceRestartOffer, type IceServerLike, type Recovery,
} from "@/lib/ice-recovery";

// The browser side of lib/ice-recovery.ts, shared by 1:1 calls (CallManager) and group calls (GroupCall): one per connection.
// It watches the connection, restarts ICE when it's this side's turn (with fresh relay credentials, and once forced through the relay
// when the direct restarts don't connect), answers the other side's restarts, and holds connection candidates that arrive before the
// description they belong to.

// Candidates from the other side: added when they fit the description we have; kept for the next one when they belong to a newer one.
export function candidateSink(pc: RTCPeerConnection) {
  let held: RTCIceCandidateInit[] = [];
  const fits = (c: RTCIceCandidateInit) => !!pc.remoteDescription && candidateFits(c, pc.remoteDescription.sdp);
  return {
    async add(c: RTCIceCandidateInit) {
      if (!fits(c)) { held.push(c); return; }
      await pc.addIceCandidate(c).catch(() => {});
    },
    async flush() {
      const ready = held.filter(fits);
      held = held.filter((c) => !fits(c));
      for (const c of ready) await pc.addIceCandidate(c).catch(() => {});
    },
  };
}

export type RecoveryHooks = {
  pc: RTCPeerConnection;
  me: string;
  drives: boolean; // this side restarts (the caller; in a group, the smaller uid of the pair)
  canRelay: () => boolean; // a TURN relay is in the address book
  freshIce: () => Promise<IceServerLike[] | null>; // new relay credentials (they're short-lived); null keeps the ones we have
  sendOffer: (r: IceRestartOffer) => Promise<void>;
  sendAnswer: (a: IceRestartAnswer) => Promise<void>;
  flush: () => Promise<void>; // add the candidates that were waiting for the new description
  onReconnecting: (on: boolean) => void;
  onRecovered: () => void; // connected again: recompute the safety code
  onGiveUp: () => void;
};

export function watchRecovery(h: RecoveryHooks) {
  let rec: Recovery = freshRecovery();
  let n = 0; // my latest restart (waiting for its answer)
  let answered = 0; // the other side's latest restart I answered
  let stopped = false;
  let shown = false;
  const show = () => { const on = isReconnecting(rec); if (on !== shown) { shown = on; h.onReconnecting(on); } };

  // New relay credentials (and, for the forced-relay restart, the relay-only policy) before new paths are gathered. A browser that can't
  // change its configuration mid-call still restarts with what it has.
  const refresh = async (relay: boolean) => {
    const ice = await h.freshIce().catch(() => null);
    try {
      const cfg = h.pc.getConfiguration();
      h.pc.setConfiguration({ ...cfg, ...(ice?.length ? { iceServers: ice as RTCIceServer[] } : {}), iceTransportPolicy: relay ? "relay" : cfg.iceTransportPolicy ?? "all" });
    } catch { /* keep the configuration we have */ }
  };
  const restart = async (relay: boolean) => {
    try {
      await refresh(relay);
      if (stopped) return;
      const offer = await h.pc.createOffer({ iceRestart: true });
      await h.pc.setLocalDescription(offer);
      n += 1;
      await h.sendOffer({ n, by: h.me, offer: { type: offer.type, sdp: offer.sdp ?? "" }, ...(relay ? { relay: true } : {}) });
    } catch {
      /* the next attempt (or giving up) follows on the clock */
    }
  };
  const act = (a: ReturnType<typeof stepRecovery>["action"]) => {
    if (a === "restart") void restart(false);
    else if (a === "restart-relay") void restart(true);
    else if (a === "recovered") h.onRecovered();
    else if (a === "give-up") { stopped = true; h.onGiveUp(); }
  };
  const feed = (ev: Parameters<typeof stepRecovery>[1]) => {
    if (stopped) return;
    const r = stepRecovery(rec, ev, Date.now(), { drives: h.drives, canRelay: h.canRelay() });
    rec = r.rec;
    show();
    act(r.action);
  };
  const onState = () => feed({ type: "state", state: h.pc.connectionState });
  h.pc.addEventListener("connectionstatechange", onState);
  const clock = setInterval(() => feed({ type: "tick" }), 1000);

  return {
    // The signalling doc changed: answer the other side's restart, or take the answer to mine.
    async onSignal(restart: IceRestartOffer | undefined | null, answer: IceRestartAnswer | undefined | null) {
      if (stopped) return;
      try {
        if (restartToAnswer(restart, h.me, answered) && restart) {
          answered = restart.n;
          await refresh(false);
          await h.pc.setRemoteDescription(restart.offer as RTCSessionDescriptionInit);
          await h.flush();
          const a = await h.pc.createAnswer();
          await h.pc.setLocalDescription(a);
          await h.sendAnswer({ n: restart.n, answer: { type: a.type, sdp: a.sdp ?? "" } });
        } else if (answerFits(answer, n) && answer && h.pc.signalingState === "have-local-offer") {
          await h.pc.setRemoteDescription(answer.answer as RTCSessionDescriptionInit);
          await h.flush();
        }
      } catch {
        /* a stale or crossed description: the next restart replaces it */
      }
    },
    stop() { stopped = true; clearInterval(clock); h.pc.removeEventListener("connectionstatechange", onState); if (shown) h.onReconnecting(false); },
  };
}
