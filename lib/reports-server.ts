import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { isMomentExpired, isReportReason, REPORT_NOTE_MAX, REPORT_URGENT_HOURS, URGENT_REASONS } from "./moments-rules";
import { sendEmail } from "./email";
import { MomentError, adminRemoveMoment, type MomentDeps } from "./moments-server";

// Reports on moments and conversations. Because moments disappear and messages can be deleted, a report keeps a copy of
// what was reported (and, for a moment, its files) until someone at #NotesApp has looked at it; resolving the report then
// deletes that copy. The reporter and the reported member never see each other's side. Server-only (see firestore.rules).
export type ReportKind = "moment" | "conversation";

export type MediaDeps = Pick<MomentDeps, "remove" | "publicUrl">;

const trimNote = (note: unknown) => {
  const s = typeof note === "string" ? note.trim() : "";
  if (s.length > REPORT_NOTE_MAX) throw new MomentError(413, `A note can be up to ${REPORT_NOTE_MAX} characters.`);
  return s;
};

export async function createReport(
  db: Firestore, reporterUid: string, input: { kind: unknown; targetId: unknown; reason: unknown; note?: unknown }, now = new Date(),
  alertTeam: (subject: string, text: string) => Promise<void> = emailTeam
): Promise<{ id: string }> {
  const kind = input.kind;
  if (kind !== "moment" && kind !== "conversation") throw new MomentError(400, "Choose what to report.");
  if (!isReportReason(input.reason)) throw new MomentError(400, "Choose a reason.");
  const targetId = String(input.targetId ?? "");
  const note = trimNote(input.note);
  const id = `${reporterUid}_${kind}_${targetId}`; // one report per person per thing
  const ref = db.doc(`contentReports/${id}`);
  if ((await ref.get()).exists) throw new MomentError(409, "You've already reported this. Thank you, we're looking at it.");

  let targetUid: string;
  let evidence: Record<string, unknown>;
  let evidenceKeys: string[] = [];

  if (kind === "moment") {
    const m = (await db.doc(`moments/${targetId}`).get()).data();
    if (!m || isMomentExpired(m.expiresAt, now)) throw new MomentError(404, "That moment isn't available any more.");
    if (m.ownerUid === reporterUid) throw new MomentError(400, "That's your own moment.");
    const [a, b, f] = await Promise.all([
      db.doc(`dmBlocks/${m.ownerUid}_${reporterUid}`).get(), db.doc(`dmBlocks/${reporterUid}_${m.ownerUid}`).get(), db.doc(`follows/${reporterUid}_${m.ownerUsername}`).get(),
    ]);
    if (a.exists || b.exists || !f.exists) throw new MomentError(404, "That moment isn't available any more.");
    targetUid = m.ownerUid;
    evidence = {
      momentId: targetId, ownerUsername: m.ownerUsername, kind: m.kind, text: m.text ?? null, createdAt: m.createdAt, expiresAt: m.expiresAt,
      resharedFrom: m.resharedFrom ?? null, hasVoiceOver: !!m.audioKey,
    };
    // The files belong to the original when this is a reshare; keep those too, and flag the original so nothing deletes them.
    const rootId: string = m.resharedFrom?.rootMomentId ?? targetId;
    const root = rootId === targetId ? m : (await db.doc(`moments/${rootId}`).get()).data();
    evidenceKeys = [root?.imageKey, root?.videoKey, root?.audioKey ?? m.audioKey].filter((k): k is string => !!k);
    evidence.imageKey = root?.imageKey ?? null; evidence.videoKey = root?.videoKey ?? null;
    const flag = { reported: true };
    await db.doc(`moments/${targetId}`).update(flag);
    if (rootId !== targetId && root) await db.doc(`moments/${rootId}`).update(flag).catch(() => {});
  } else {
    const c = (await db.doc(`conversations/${targetId}`).get()).data();
    if (!c || !(c.participants as string[]).includes(reporterUid)) throw new MomentError(404, "That conversation wasn't found.");
    targetUid = (c.participants as string[]).find((p) => p !== reporterUid) ?? reporterUid;
    // The last 20 messages, as they were when it was reported.
    const msgs = await db.collection(`conversations/${targetId}/messages`).orderBy("createdAt", "desc").limit(20).get();
    evidence = { conversationId: targetId, messages: msgs.docs.reverse().map((d) => ({ from: d.data().from, text: d.data().text, createdAt: d.data().createdAt, ...(d.data().momentRef ? { replyToMoment: true } : {}) })) };
  }

  await ref.set({
    reporterUid, targetUid, kind, targetId, reason: input.reason, note, status: "open", createdAt: now.toISOString(), evidence, evidenceKeys,
  });
  // Nudity and violence are looked at within 24 hours: tell the team now (REPORTS_EMAIL), not when someone next opens the page.
  if (URGENT_REASONS.includes(input.reason)) {
    await alertTeam(`Urgent report: ${input.reason} (${kind})`, `A ${kind} was reported for ${input.reason}. Please review it within ${REPORT_URGENT_HOURS} hours: ${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng").replace(/\/$/, "")}/admin/reports`).catch(() => {});
  }
  return { id };
}

async function emailTeam(subject: string, text: string): Promise<void> {
  const to = process.env.REPORTS_EMAIL;
  if (to) await sendEmail({ to, subject, text });
}

export type ReportRow = { id: string; kind: ReportKind; reason: string; note: string; createdAt: string; status: string; reporterUid: string; targetUid: string; evidence?: unknown; evidenceKeys?: string[]; outcome?: string };

export async function listReports(db: Firestore, status: "open" | "resolved" = "open", limit = 100): Promise<ReportRow[]> {
  const snap = await db.collection("contentReports").where("status", "==", status).limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReportRow, "id">) })).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

// Closes a report: "dismissed" (nothing wrong) or "actioned" (we acted: removed content, warned or suspended through the Users page).
// Either way the copy of what was reported, and any files kept for it, are deleted now.
export async function resolveReport(db: Firestore, adminUid: string, id: string, outcome: unknown, note: unknown, deps: MediaDeps, now = new Date()): Promise<void> {
  if (outcome !== "dismissed" && outcome !== "actioned") throw new MomentError(400, "Choose dismissed or actioned.");
  const ref = db.doc(`contentReports/${id}`);
  const r = (await ref.get()).data();
  if (!r) throw new MomentError(404, "That report wasn't found.");
  if (r.status === "resolved") return;
  const others = await db.collection("contentReports").where("status", "==", "open").get();
  const stillNeeded = new Set(others.docs.filter((d) => d.id !== id).flatMap((d) => (d.data().evidenceKeys as string[]) ?? []));
  if (r.kind === "moment") {
    const live = (await db.doc(`moments/${r.targetId}`).get()).exists;
    if (outcome === "actioned" && live) await adminRemoveMoment(db, r.targetId, deps); // gone now, files with it
    else if (live) {
      // Dismissed and still live: it stays; once nothing is open against it, normal expiry (and file clean-up) resumes.
      if (!others.docs.some((d) => d.id !== id && d.data().kind === "moment" && d.data().targetId === r.targetId)) await db.doc(`moments/${r.targetId}`).update({ reported: false }).catch(() => {});
    }
    // Files kept as evidence go unless another open report needs them, or the moment is still live and will clean up by itself.
    if (!live || outcome === "actioned") for (const k of (r.evidenceKeys as string[]) ?? []) if (!stillNeeded.has(k)) await deps.remove(k).catch(() => {});
  }
  await ref.update({ status: "resolved", outcome, resolvedBy: adminUid, resolvedAt: now.toISOString(), resolutionNote: trimNote(note), evidence: FieldValue.delete(), evidenceKeys: [] });
}
