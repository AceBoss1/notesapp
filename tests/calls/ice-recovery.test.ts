// Getting a call back after the network changes (lib/ice-recovery.ts): when to restart ICE, when to force the relay, when to give up,
// who restarts, and the helpers for the restart's offer, answer and connection candidates. Run: npm run test:calls → "ALL OK".
import assert from "node:assert/strict";
import {
  ATTEMPT_MS, DIRECT_RESTARTS, GIVE_UP_MS, PASSIVE_GIVE_UP_MS, RECOVER_WAIT_MS, answerFits, candidateFits, codeChanged, freshRecovery, hasTurn,
  iceUfrag, isReconnecting, restartToAnswer, restartsPair, stepRecovery, type Recovery, type RecoveryAction, type RecoveryOpts,
} from "../../lib/ice-recovery";

const DRIVER: RecoveryOpts = { drives: true, canRelay: true };
// Runs a script of events, returning the actions with their times.
function run(o: RecoveryOpts, script: [number, string][], until: number): { at: number; action: RecoveryAction }[] {
  let rec: Recovery = freshRecovery();
  const out: { at: number; action: RecoveryAction }[] = [];
  const events = new Map(script);
  for (let t = 0; t <= until; t += 500) {
    const st = events.get(t);
    const r1 = st ? stepRecovery(rec, { type: "state", state: st }, t, o) : stepRecovery(rec, { type: "tick" }, t, o);
    rec = r1.rec;
    if (r1.action !== "none") out.push({ at: t, action: r1.action });
    if (rec.phase === "over") break;
  }
  return out;
}

// ── the totals stay under 30 seconds, and the passive side waits longer than the driver ──
assert.ok(RECOVER_WAIT_MS + (DIRECT_RESTARTS + 1) * ATTEMPT_MS <= GIVE_UP_MS, "every attempt fits before giving up");
assert.ok(GIVE_UP_MS < 30_000 && PASSIVE_GIVE_UP_MS > GIVE_UP_MS && PASSIVE_GIVE_UP_MS <= 32_000);

// ── a blip: "disconnected" that comes back by itself never restarts ──
assert.deepEqual(run(DRIVER, [[1000, "disconnected"], [2000, "connected"]], 40_000), [{ at: 2000, action: "recovered" }]);

// ── nothing works: two direct restarts, then one through the relay, then the call ends ──
const all = run(DRIVER, [[1000, "disconnected"]], 60_000);
assert.deepEqual(all, [
  { at: 1000 + RECOVER_WAIT_MS, action: "restart" },
  { at: 1000 + RECOVER_WAIT_MS + ATTEMPT_MS, action: "restart" },
  { at: 1000 + RECOVER_WAIT_MS + 2 * ATTEMPT_MS, action: "restart-relay" },
  { at: 1000 + GIVE_UP_MS, action: "give-up" },
]);
assert.ok(all[all.length - 1].at - 1000 < 30_000, "the call ends under 30 seconds after it dropped");

// ── without a TURN relay: only the direct restarts, then the end ──
assert.deepEqual(run({ drives: true, canRelay: false }, [[0, "disconnected"]], 60_000).map((x) => x.action), ["restart", "restart", "give-up"]);

// ── "failed" restarts at once, and a failed attempt moves straight to the next one ──
const f = run(DRIVER, [[0, "failed"], [3000, "failed"]], 60_000);
assert.deepEqual(f.slice(0, 3), [{ at: 0, action: "restart" }, { at: 3000, action: "restart" }, { at: 3000 + ATTEMPT_MS, action: "restart-relay" }]);

// ── the first restart works: back to normal, ready for the next drop (which starts its own count) ──
const ok = run(DRIVER, [[0, "disconnected"], [4000, "connected"], [10_000, "disconnected"]], 13_000);
assert.deepEqual(ok, [{ at: RECOVER_WAIT_MS, action: "restart" }, { at: 4000, action: "recovered" }, { at: 10_000 + RECOVER_WAIT_MS, action: "restart" }]);

// ── the relay is forced only after the direct restarts, and stays forced once it worked ──
let rec = freshRecovery();
rec = stepRecovery(rec, { type: "state", state: "failed" }, 0, DRIVER).rec;
assert.equal(rec.relay, false, "the first restart lets ICE choose a direct path");
rec = stepRecovery(rec, { type: "state", state: "failed" }, 100, DRIVER).rec;
assert.equal(rec.relay, false);
const third = stepRecovery(rec, { type: "state", state: "failed" }, 200, DRIVER);
assert.equal(third.action, "restart-relay"); assert.equal(third.rec.relay, true);
const back = stepRecovery(third.rec, { type: "state", state: "connected" }, 300, DRIVER);
assert.equal(back.action, "recovered"); assert.equal(back.rec.relay, true); assert.equal(back.rec.phase, "ok");
assert.equal(isReconnecting(third.rec), true); assert.equal(isReconnecting(back.rec), false);

// ── the side that only answers never restarts, and gives up after the driver ──
const passive = run({ drives: false, canRelay: true }, [[0, "disconnected"]], 60_000);
assert.deepEqual(passive, [{ at: PASSIVE_GIVE_UP_MS, action: "give-up" }]);
assert.deepEqual(run({ drives: false, canRelay: true }, [[0, "disconnected"], [9000, "connected"]], 60_000), [{ at: 9000, action: "recovered" }]);

// ── over is over; other states change nothing ──
const over = stepRecovery({ ...freshRecovery(), phase: "over" }, { type: "state", state: "failed" }, 0, DRIVER);
assert.equal(over.action, "none");
for (const st of ["new", "connecting", "checking", "closed"]) assert.equal(stepRecovery(freshRecovery(), { type: "state", state: st }, 0, DRIVER).action, "none");
assert.equal(stepRecovery(freshRecovery(), { type: "state", state: "connected" }, 0, DRIVER).action, "none", "connected at the start isn't a recovery");

// ── who restarts in a group call's pair: the smaller uid, so exactly one of the two ──
assert.equal(restartsPair("alice", "pub"), true); assert.equal(restartsPair("pub", "alice"), false);

// ── TURN in the address book ──
assert.equal(hasTurn([{ urls: ["stun:stun.cloudflare.com:3478"] }]), false);
assert.equal(hasTurn([{ urls: "stun:x" }, { urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turns:turn.cloudflare.com:443?transport=tcp"], username: "u", credential: "c" }]), true);
assert.equal(hasTurn([{ urls: "TURNS:x:443" }]), true);
assert.equal(hasTurn(null), false);

// ── candidates wait for the description they belong to ──
const sdp1 = "v=0\r\na=ice-ufrag:old1\r\na=ice-pwd:x\r\n", sdp2 = "v=0\r\na=ice-ufrag:new2\r\n";
assert.equal(iceUfrag(sdp1), "old1"); assert.equal(iceUfrag(sdp2), "new2"); assert.equal(iceUfrag("v=0"), null);
assert.equal(candidateFits({ usernameFragment: "old1" }, sdp1), true);
assert.equal(candidateFits({ usernameFragment: "new2" }, sdp1), false, "a candidate for the restart's offer waits for that offer");
assert.equal(candidateFits({ usernameFragment: "new2" }, sdp2), true);
assert.equal(candidateFits({}, sdp1), true, "no fragment: added as before");
assert.equal(candidateFits({ usernameFragment: null }, sdp1), true);

// ── the restart's offer and answer ──
const offer = { n: 2, by: "alice", offer: { type: "offer", sdp: "v=0" } };
assert.equal(restartToAnswer(offer, "pub", 1), true);
assert.equal(restartToAnswer(offer, "pub", 2), false, "answered already");
assert.equal(restartToAnswer(offer, "alice", 0), false, "never my own");
assert.equal(restartToAnswer(undefined, "pub", 0), false);
assert.equal(restartToAnswer({ ...offer, offer: { type: "offer", sdp: "" } }, "pub", 0), false);
assert.equal(answerFits({ n: 2, answer: { type: "answer", sdp: "v=0" } }, 2), true);
assert.equal(answerFits({ n: 1, answer: { type: "answer", sdp: "v=0" } }, 2), false, "an answer to an older restart is ignored");
assert.equal(answerFits({ n: 0, answer: { type: "answer", sdp: "v=0" } }, 0), false, "no restart waiting");

// ── the safety code after a restart ──
assert.equal(codeChanged("123 456", "123 456"), false);
assert.equal(codeChanged("123 456", "999 000"), true);
assert.equal(codeChanged("", "999 000"), false, "the first code isn't a change");

console.log("ALL OK");
