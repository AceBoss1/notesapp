import type { CallKind } from "./calls";

// Free group calls in a group chat, phone to phone (a "mesh"): every person in the call connects straight to every other person, so the
// call stays encrypted between devices and nothing passes through us. Each phone sends its picture to everyone else, which is why calls
// are small: up to 6 people talking, up to 4 on video. Bigger meetings need a paid video service (the Community plan, phase 3).
//
// groupCalls/{id}: who may join (the group's members when it started), who is in it now (`joined`, with a heartbeat), and its status.
// groupCalls/{id}/links/{auto}: one connection between two people. Whoever joins later offers ({ from: newcomer, to: someone already in }),
// the other answers; their connection candidates go in fromCandidates / toCandidates.

export const GROUP_CALL_MAX: Record<CallKind, number> = { audio: 6, video: 4 };
export const GROUP_BEAT_MS = 20_000; // each person in the call checks in this often
export const GROUP_GONE_MS = 60_000; // someone not heard from for this long has left (their app closed or lost the network)
export const GROUP_RING_MS = 45_000; // members are rung for this long after the call starts

export type GroupCallPerson = { name: string; avatar: string; at: string; seen: string };
export type GroupCallDoc = {
  cid: string; kind: CallKind; title: string; startedBy: string; startedByName: string;
  memberUids: string[]; joined: Record<string, GroupCallPerson>; status: "live" | "ended";
  createdAt: string; endedAt?: string; seconds?: number; peak?: number;
};
export type GroupLink = { from: string; to: string; at: string; offer?: { type: string; sdp: string }; answer?: { type: string; sdp: string } };

// Who is really still in the call (heard from recently).
export function present(c: Pick<GroupCallDoc, "joined">, now = Date.now()): string[] {
  return Object.entries(c.joined ?? {}).filter(([, p]) => now - Date.parse(p.seen) < GROUP_GONE_MS).map(([uid]) => uid);
}
export const isFull = (c: Pick<GroupCallDoc, "joined" | "kind">, now = Date.now()) => present(c, now).length >= GROUP_CALL_MAX[c.kind];
// A call is ringing for a member who isn't in it, for the first 45 seconds, while someone is still in it.
export const ringsFor = (c: GroupCallDoc, uid: string, now = Date.now()) =>
  c.status === "live" && c.memberUids.includes(uid) && !present(c, now).includes(uid) && present(c, now).length > 0 && now - Date.parse(c.createdAt) < GROUP_RING_MS;
// "Group voice call · 12:03 · 4 people"
export function groupCallText(kind: CallKind, seconds: number, peak: number): string {
  const d = `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  return `Group ${kind === "video" ? "video" : "voice"} call · ${d}${peak > 1 ? ` · ${peak} people` : ""}`;
}
