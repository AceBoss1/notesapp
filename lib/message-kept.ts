import type { Firestore } from "firebase-admin/firestore";

// When a message is deleted (or removed by an admin or #NotesApp), every kept copy of it goes too.
export async function dropKept(db: Firestore, messageId: string): Promise<void> {
  const snap = await db.collection("keptMessages").where("messageId", "==", messageId).limit(500).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}
