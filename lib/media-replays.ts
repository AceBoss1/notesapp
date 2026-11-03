import type { Firestore } from "firebase-admin/firestore";
import type { ReplayTile } from "./media-rules";
import type { ReplayDoc } from "./live-recording";

// The Lives & replays tab of a creator's Media (the counts, the grid, /u/{username}/media) reads its tiles from here: the creator's
// published replays that are ready to play and listed, the same ones Explore and Trending show (lib/live-recording.ts: for everyone or
// for the creator's subscribers; the replay's own page checks who may watch). A replay kept inside its community (community audience, or
// a teen spoke) is never listed. A replay
// has no picture of its own, so the tile shows the host's profile picture (the grid draws a pattern when there is none).
export async function replaysFor(db: Firestore, uid: string): Promise<ReplayTile[]> {
  const snap = await db.collection("replays").where("hostUid", "==", uid).limit(200).get();
  return snap.docs
    .map((d) => ({ id: d.id, r: d.data() as ReplayDoc }))
    .filter(({ r }) => r.status === "ready" && r.listed === true)
    .sort((a, b) => b.r.publishedAt.localeCompare(a.r.publishedAt))
    .map(({ id, r }) => ({ id, title: r.title, poster: r.hostAvatar ?? "", durationSec: Math.round(r.duration ?? 0), href: `/replays/${id}`, createdAt: r.publishedAt }));
}
