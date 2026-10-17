import type { Firestore } from "firebase-admin/firestore";

export class SavedJournalError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// The bookmark on a journal (Saved, Moda redesign): savedJournals/{uid}_{noteId}, written only here; a member reads their own.
export async function toggleSavedJournal(db: Firestore, uid: string, noteId: string, now = new Date()): Promise<{ saved: boolean }> {
  if (!noteId || noteId.includes("/")) throw new SavedJournalError("Which journal?");
  const noteRef = db.doc(`notes/${noteId}`), saveRef = db.doc(`savedJournals/${uid}_${noteId}`);
  return db.runTransaction(async (t) => {
    const [note, save] = await Promise.all([t.get(noteRef), t.get(saveRef)]);
    if (save.exists) { t.delete(saveRef); return { saved: false }; }
    if (!note.exists || note.data()?.status !== "published") throw new SavedJournalError("That journal isn't published.", 404);
    t.set(saveRef, { uid, noteId, savedAt: now.toISOString() });
    return { saved: true };
  });
}
