// Group calls (lib/group-calls.ts): who is still in a call, when it's full, who it rings, and the line it leaves in the chat.
import assert from "node:assert/strict";
import { GROUP_CALL_MAX, groupCallText, isFull, present, ringsFor, type GroupCallDoc } from "../../lib/group-calls";

const t0 = Date.parse("2026-10-19T10:00:00Z");
const at = (s: number) => new Date(t0 + s * 1000).toISOString();
const person = (seen: number) => ({ name: "x", avatar: "", at: at(0), seen: at(seen) });
const call = (joined: Record<string, ReturnType<typeof person>>, kind: "audio" | "video" = "audio"): GroupCallDoc =>
  ({ cid: "g_1", kind, title: "Choir", startedBy: "a", startedByName: "Ada", memberUids: ["a", "b", "c", "d", "e", "f", "g"], joined, status: "live", createdAt: at(0) });

assert.deepEqual(GROUP_CALL_MAX, { audio: 6, video: 4 });
const c = call({ a: person(50), b: person(0) });
assert.deepEqual(present(c, t0 + 70_000).sort(), ["a"], "b hasn't checked in for 70 s: gone");
assert.deepEqual(present(c, t0 + 30_000).sort(), ["a", "b"]);
assert.equal(isFull(call({ a: person(0), b: person(0), c: person(0), d: person(0) }, "video"), t0), true, "4 on video is full");
assert.equal(isFull(call({ a: person(0), b: person(0), c: person(0), d: person(0) }, "audio"), t0), false, "4 talking is not");
assert.equal(ringsFor(c, "c", t0 + 10_000), true);
assert.equal(ringsFor(c, "a", t0 + 10_000), false, "not for someone in it");
assert.equal(ringsFor(c, "z", t0 + 10_000), false, "not for someone outside the group");
assert.equal(ringsFor(c, "c", t0 + 50_000), false, "stops after 45 s");
assert.equal(ringsFor({ ...c, status: "ended" }, "c", t0 + 10_000), false);
assert.equal(groupCallText("audio", 723, 4), "Group voice call · 12:03 · 4 people");
assert.equal(groupCallText("video", 5, 1), "Group video call · 0:05");
console.log("ALL OK");
