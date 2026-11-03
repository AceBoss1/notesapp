import type { Firestore } from "firebase-admin/firestore";
import type { ReplayTile } from "./media-rules";

// The Lives & replays tab of a creator's Media reads its tiles from here. Replays (recording, publishing, the 30-day timer) are being built
// on another branch (PR #256, "recording/replays"); until that lands there is nothing to read, so this returns none and the tab says so.
//
// MERGE POINT for the replays branch: read the creator's PUBLISHED replays (never unpublished or expired recordings, and none of a teen's:
// teens can't go live) and map each to a ReplayTile, newest first, e.g.
//   const s = await db.collection("replays").where("hostUid", "==", uid).get();
//   return s.docs.filter((d) => d.data().published === true).map((d) => ({ id: d.id, title, poster, durationSec, href: `/replays/${d.id}`, createdAt }));
// Everything that shows the tab (counts, the grid, /profile/media) already goes through this one function.
export async function replaysFor(db: Firestore, uid: string): Promise<ReplayTile[]> {
  void db; void uid;
  return [];
}
