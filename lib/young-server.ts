import type { Firestore } from "firebase-admin/firestore";
import { FieldPath } from "firebase-admin/firestore";
import { notifyBell, sendEmail } from "./email";
import { LEGAL_VERSION } from "./legal";
import { lagosDate } from "./team";
import { setDigestWanted } from "./digest-server";
import { YoungError, cleanChoice, graduationDue, keepFlags } from "./young";

// Turning 18 (lib/young.ts has the rules). The birth month and year is in prepTeens/{uid} (teen mode, lib/exam-prep-server.ts), with
// the parent's email. Graduating ends teen mode, keeps whatever protections the member left on (users.keep*), records their own
// consent, tells the parent the account is now theirs and removes the parent's link, and can delete their day-by-day practice log.

export async function graduationStatus(db: Firestore, uid: string, now = new Date()) {
  const [u, t] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`prepTeens/${uid}`).get()]);
  const due = u.data()?.teen === true && u.data()?.kid !== true && graduationDue(t.data()?.birth, lagosDate(now));
  return { due, name: String(u.data()?.displayName ?? "") };
}

// Everything we hold about them from teen mode, as one file to keep.
export async function exportMine(db: Firestore, uid: string) {
  const [u, prog, board, life, teen] = await Promise.all(["users", "prepProgress", "prepBoard", "lifePlayers", "prepTeens"].map((c) => db.doc(`${c}/${uid}`).get()));
  const t = teen.data();
  return {
    exportedAt: new Date().toISOString(),
    profile: u.data() ?? null, examPrepProgress: prog.data() ?? null, examPrepBoard: board.data() ?? null, notesLife: life.data() ?? null,
    teenMode: t ? { parentEmail: t.parentEmail, birth: t.birth, askedAt: t.askedAt, confirmedAt: t.confirmedAt } : null,
  };
}

export async function graduate(db: Firestore, uid: string, b: Record<string, unknown>, now = new Date(), send = sendEmail) {
  const st = await graduationStatus(db, uid, now);
  if (!st.due) throw new YoungError("This is for teen mode, on your 18th birthday.", 409);
  const c = cleanChoice(b);
  const at = now.toISOString();
  const teenRef = db.doc(`prepTeens/${uid}`);
  const parentEmail = String((await teenRef.get()).data()?.parentEmail ?? "");
  await db.doc(`users/${uid}`).set({ teen: false, graduatedAt: at, ...keepFlags(c), consent: { version: LEGAL_VERSION, at, own: true } }, { merge: true });
  if ((await db.doc(`prepBoard/${uid}`).get()).exists) await db.doc(`prepBoard/${uid}`).set({ realName: c.realName }, { merge: true });
  await setDigestWanted(db, uid, c.offers);
  // A fresh start, if asked: the day-by-day practice log goes; progress, scores and certificates stay.
  if (b.deleteChildhood === true) {
    const days = await db.collection("prepAttempts").where(FieldPath.documentId(), ">=", `${uid}_`).where(FieldPath.documentId(), "<", `${uid}_~`).get();
    await Promise.all(days.docs.map((d) => d.ref.delete()));
  }
  if (parentEmail) await send({ to: parentEmail, subject: "Their NotesApp account is now their own", text: `Hello,\n\nThe student you confirmed for teen mode on Naija Exam Prep has turned 18, and their NotesApp account is now their own. We've removed your email from it, so you won't hear from us about it again.\n\nThank you for looking after them.\n\nNotesApp` }).catch(() => false);
  await teenRef.delete(); // the parent's email and the birth month go with it
  await notifyBell({ uid, type: "plan", linkHref: "/pricing", message: "Your account is all yours now. Want to publish? Try Pro free for 15 days." }).catch(() => {});
  return { graduated: true, choice: c };
}

// Daily (in the cron): a bell for each teen whose 18th birthday has come, once.
export async function birthdayBells(db: Firestore, now = new Date(), notify = notifyBell): Promise<number> {
  const today = lagosDate(now);
  const s = await db.collection("prepTeens").get();
  let n = 0;
  for (const d of s.docs) {
    if (d.data().told18 || !graduationDue(d.data().birth, today)) continue;
    await d.ref.update({ told18: now.toISOString() });
    await notify({ uid: d.id, type: "plan", linkHref: "/eighteen", message: "Happy 18th birthday! 🎉 Your account becomes yours: choose what changes." }).catch(() => {});
    n++;
  }
  return n;
}
