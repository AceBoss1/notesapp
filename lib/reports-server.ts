import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { isMomentExpired, isReportReason, REPORT_NOTE_MAX, REPORT_REASON_LABEL, type ReportReason, REPORT_URGENT_HOURS, URGENT_REASONS } from "./moments-rules";
import { sendEmail } from "./email";
import { isSuspensionLength, suspensionEnd, describeUntil } from "./suspension-length";
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
  // Only nudity and violence email the team straight away (we promise to review those within 24 hours); everything else waits for the
  // daily digest (sendReportsDigest), so reports can't eat the sending quota.
  if (URGENT_REASONS.includes(input.reason)) {
    const link = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng").replace(/\/$/, "")}/admin/reports`;
    await emailTeam(`URGENT: ${REPORT_REASON_LABEL[input.reason]} report on #NotesApp`, `A ${kind} was just reported for "${REPORT_REASON_LABEL[input.reason]}". We aim to review these within ${REPORT_URGENT_HOURS} hours.\n\nReview it here: ${link}`).catch(() => {});
  }
  return { id };
}

const DIGEST_HOUR = 8; // Lagos time: the daily digest goes out once it is 8am or later

export async function emailTeam(subject: string, text: string): Promise<void> {
  const to = process.env.REPORTS_EMAIL;
  if (to) await sendEmail({ to, subject, text });
}

// One email a day to the team (REPORTS_EMAIL) listing what's waiting: the count, how many are urgent (nudity or violence) and how many of
// those are overdue, and a breakdown by reason. Nothing is sent on a day with no open reports. Run by the scheduler; the day it last went
// out is kept in cronRuns/reportsDigest so the 15-minute scheduler can't send it twice. Returns whether an email was sent.
export async function sendReportsDigest(db: Firestore, now = new Date(), send: (subject: string, text: string) => Promise<void> = emailTeam): Promise<boolean> {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", hour12: false }).format(now)) % 24;
  if (hour < DIGEST_HOUR) return false;
  const today = now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const stateRef = db.doc("cronRuns/reportsDigest");
  if ((await stateRef.get()).data()?.day === today) return false;
  const snap = await db.collection("contentReports").where("status", "==", "open").select("reason", "kind", "createdAt").get();
  await stateRef.set({ day: today, at: now.toISOString(), open: snap.size }); // marked first: a failed send is not retried every 15 minutes
  if (snap.empty) return false;
  const counts = await reportCounts(db, now);
  const byReason = new Map<string, number>();
  for (const d of snap.docs) byReason.set(d.data().reason, (byReason.get(d.data().reason) ?? 0) + 1);
  const lines = Array.from(byReason.entries()).sort((a, b) => b[1] - a[1]).map(([r, n]) => `  ${n} × ${r}${URGENT_REASONS.includes(r as never) ? " (urgent)" : ""}`);
  const link = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng").replace(/\/$/, "")}/admin/reports`;
  const head = counts.overdue > 0 ? `${counts.overdue} OVERDUE (waiting more than ${REPORT_URGENT_HOURS} hours), ` : "";
  await send(
    `${counts.urgent > 0 ? "URGENT: " : ""}${snap.size} open report${snap.size === 1 ? "" : "s"} on #NotesApp`,
    `${head}${counts.urgent} urgent (nudity or violence: reviewed within ${REPORT_URGENT_HOURS} hours), ${snap.size} open in all.\n\n${lines.join("\n")}\n\nReview them here: ${link}`
  ).catch(() => {});
  return true;
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

// One click from a report: suspend the reported member (same records the Users page writes: the private suspensions/{uid} with the
// reason, `suspended` on the public profile, and a notification to them), then action the report. Admins can't be suspended this way.
export async function suspendFromReport(db: Firestore, adminUid: string, id: string, note: unknown, length: unknown, deps: MediaDeps, now = new Date()): Promise<void> {
  if (!isSuspensionLength(length)) throw new MomentError(400, "Choose how long to suspend them for.");
  const r = (await db.doc(`contentReports/${id}`).get()).data();
  if (!r) throw new MomentError(404, "That report wasn't found.");
  if (r.status === "resolved") throw new MomentError(409, "That report is already resolved.");
  const target = (await db.doc(`users/${r.targetUid}`).get()).data();
  if (!target) throw new MomentError(404, "That member wasn't found.");
  if (target.role === "admin") throw new MomentError(403, "Admins can't be suspended from a report.");
  if (target.suspended !== true) {
    const reason = trimNote(note) || `Reported for ${REPORT_REASON_LABEL[r.reason as ReportReason] ?? r.reason}`;
    const until = suspensionEnd(length, now);
    await db.doc(`suspensions/${r.targetUid}`).set({ reason, suspendedAt: now.toISOString(), suspendedByUid: adminUid, appealStatus: "none", ...(until ? { until } : {}) });
    await db.doc(`users/${r.targetUid}`).update({ suspended: true });
    await db.collection("notifications").add({ recipientUid: r.targetUid, type: "suspended", message: `Your account was suspended ${describeUntil(until)}: ${reason}`, linkHref: `/u/${target.username}`, read: false, createdAt: now.toISOString() });
  }
  await resolveReport(db, adminUid, id, "actioned", note, deps, now);
}

// Lifts suspensions whose time is up (run by the scheduler): the account goes active again, the member is told, and the record keeps
// who/when for the history. Suspensions without an end are never touched. Returns how many accounts were reactivated.
export async function liftExpiredSuspensions(db: Firestore, now = new Date()): Promise<number> {
  const due = await db.collection("suspensions").where("until", "<=", now.toISOString()).get();
  let lifted = 0;
  for (const d of due.docs) {
    const user = await db.doc(`users/${d.id}`).get();
    if (user.data()?.suspended === true) {
      await db.doc(`users/${d.id}`).update({ suspended: false });
      await db.collection("notifications").add({ recipientUid: d.id, type: "unsuspended", message: "Your suspension has ended, your account is active again.", linkHref: `/u/${user.data()?.username}`, read: false, createdAt: now.toISOString() });
      lifted++;
    }
    await d.ref.update({ until: FieldValue.delete(), appealStatus: "none", resolvedAt: now.toISOString(), resolvedByUid: "system" });
  }
  return lifted;
}

// For the admin dashboard card: how many reports are open, how many of those are urgent (nudity or violence), and how many of
// the urgent ones have waited past the 24 hours we promise.
export async function reportCounts(db: Firestore, now = new Date()): Promise<{ open: number; urgent: number; overdue: number }> {
  const snap = await db.collection("contentReports").where("status", "==", "open").select("reason", "createdAt").get();
  let urgent = 0, overdue = 0;
  for (const d of snap.docs) {
    const r = d.data();
    if (!URGENT_REASONS.includes(r.reason)) continue;
    urgent++;
    if (now.getTime() - new Date(r.createdAt).getTime() >= REPORT_URGENT_HOURS * 3_600_000) overdue++;
  }
  return { open: snap.size, urgent, overdue };
}
