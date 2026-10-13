import type { Firestore } from "firebase-admin/firestore";
import { resolveAuthorUsername } from "./journals-directory";

// Fan-out of "X published …" to everyone following or subscribed to the author, done on the server so the follow records
// never have to be readable by browsers. Only the founders and @na-notesapp publish under a name we can map to a username.
export async function notifyNewPostServer(db: Firestore, noteId: string, now = new Date()): Promise<{ sent: number; skipped?: string }> {
  const ref = db.doc(`notes/${noteId}`);
  const claimed = await db.runTransaction(async (tx) => {
    const n = (await tx.get(ref)).data();
    if (!n) return { skip: "Note not found." } as const;
    if (n.status !== "published") return { skip: "Not published." } as const;
    if (n.newPostNotifiedAt) return { skip: "Already sent." } as const;
    tx.update(ref, { newPostNotifiedAt: now.toISOString() });
    return { note: n } as const;
  });
  if ("skip" in claimed) return { sent: 0, skipped: claimed.skip };
  const n = claimed.note;
  const username = resolveAuthorUsername(String(n.author ?? ""));
  if (!username) return { sent: 0, skipped: "Unmapped author." };

  const [follows, subs] = await Promise.all([
    db.collection("follows").where("username", "==", username).get(),
    db.collection("subscriptions").where("username", "==", username).get(),
  ]);
  const uids = new Set<string>([...follows.docs.map((d) => String(d.data().followerUid)), ...subs.docs.map((d) => String(d.data().subscriberUid))]);
  uids.delete("na-notesapp"); // the official account has no inbox
  const list = Array.from(uids);
  for (let i = 0; i < list.length; i += 400) {
    const batch = db.batch();
    list.slice(i, i + 400).forEach((uid) => {
      batch.set(db.collection("notifications").doc(), {
        recipientUid: uid, type: "new_post",
        message: `${n.author} published "${n.title}"`,
        actorUsername: username, actorDisplayName: n.author,
        linkHref: `/journals/${n.slug}`, read: false, createdAt: now.toISOString(),
      });
    });
    await batch.commit();
  }
  return { sent: list.length };
}
