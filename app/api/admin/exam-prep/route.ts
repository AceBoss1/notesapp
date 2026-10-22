import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { verifyAdminRequest } from "@/lib/firebase-admin";
import { fulfillPayment } from "@/lib/payments";
import { refundPayment } from "@/lib/refunds";
import {
  PrepError, adminGrant, adminRefund, allPacks, allSubjects, closeInvite, createInvite, importQuestions, reviewQuestion, lookupAccess, prepMetrics, publishQuestion, reviewQueue, saveQuestion,
} from "@/lib/exam-prep-server";
import { EXAMS, isExamId, parseCsv, rowsToInputs, slug, subjectKey, type ExamId, type QuestionInput, type Subject } from "@/lib/exam-prep";
import starter from "@/content/exam-prep/starter.json";
import { bearer, body, db, fail, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
// Admin → Naija Exam Prep. Each area needs its own department, checked here (not just hidden in the page):
//   content: questions, import, publishing, subjects and topics, reviewers, reports
//   finance: pack prices, access, grants, refunds, re-checking a payment
//   product: usage counts
type Area = "content" | "finance" | "product";
async function adminFor(req: NextRequest, area: Area) {
  const uid = await verifyAdminRequest(bearer(req), [area]);
  const me = (await db().doc(`users/${uid}`).get()).data();
  return { uid, name: String(me?.displayName || me?.username || "Admin") };
}
async function findMember(q: string): Promise<string | null> {
  const s = q.trim().replace(/^@/, "");
  if (!s) return null;
  if (s.includes("@")) return getAuth().getUserByEmail(s).then((u) => u.uid).catch(() => null);
  const byName = await db().collection("users").where("username", "==", s.toLowerCase()).limit(1).get();
  if (!byName.empty) return byName.docs[0].id;
  return (await db().doc(`users/${s}`).get()).exists ? s : null;
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const view = q.get("view");
    if (view === "questions") { await adminFor(req, "content"); return ok({ questions: await reviewQueue(db(), { status: q.get("status"), exam: q.get("exam") }) }); }
    if (view === "subjects") { await adminFor(req, "content"); return ok({ subjects: await allSubjects(db()), starter: (starter as { questions: unknown[] }).questions.length }); }
    if (view === "reviewers") {
      await adminFor(req, "content");
      const [revs, invites] = await Promise.all([db().collection("prepReviewers").get(), db().collection("prepInvites").orderBy("createdAt", "desc").limit(30).get()]);
      return ok({
        reviewers: revs.docs.map((d) => { const r = d.data(); return { uid: d.id, name: r.name, active: r.active !== false, subjects: r.subjects ?? [], reviews: r.reviews ?? 0, reviewsByMonth: r.reviewsByMonth ?? {}, lastReviewAt: r.lastReviewAt ?? null, at: r.at }; }),
        invites: invites.docs.map((d) => { const i = d.data(); return { id: d.id, kind: i.kind ?? "single", subjects: i.subjects ?? [], uses: i.uses ?? (i.usedBy ? 1 : 0), maxUses: i.maxUses ?? 1, active: i.active !== false, createdAt: i.createdAt, expiresAt: i.expiresAt, note: i.note, by: i.createdByName }; }),
      });
    }
    if (view === "reports") {
      await adminFor(req, "content");
      const snap = await db().collection("prepReports").where("status", "==", q.get("status") === "resolved" ? "resolved" : "open").limit(200).get();
      return ok({ reports: snap.docs.map((d) => { const r = d.data(); return { id: d.id, questionId: r.questionId, reason: r.reason, note: r.note, at: r.at, status: r.status }; }).sort((a, b) => String(b.at).localeCompare(String(a.at))) });
    }
    if (view === "packs") { await adminFor(req, "finance"); return ok({ packs: await allPacks(db()) }); }
    if (view === "access") {
      await adminFor(req, "finance");
      const uid = await findMember(String(q.get("q") ?? ""));
      if (!uid) throw new PrepError("No member found by that email, username or id.", 404);
      const u = (await db().doc(`users/${uid}`).get()).data();
      return ok({ uid, username: u?.username ?? "", displayName: u?.displayName ?? "", teen: u?.teen === true, ...(await lookupAccess(db(), uid)) });
    }
    if (view === "metrics") { await adminFor(req, "product"); return ok(await prepMetrics(db())); }
    throw new PrepError("Unknown view.");
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const b = await body(req);
    const action = String(b.action ?? "");
    if (action === "save_question") { const a = await adminFor(req, "content"); return ok(await saveQuestion(db(), a, b.question as QuestionInput & { draft?: boolean }, b.id ? String(b.id) : undefined)); }
    if (action === "import_csv") {
      const a = await adminFor(req, "content");
      const text = String(b.csv ?? "");
      if (text.length > 2_000_000) throw new PrepError("That file is too big: up to 2 MB at a time.", 413);
      return ok(await importQuestions(db(), a, rowsToInputs(parseCsv(text), await allSubjects(db())), "editor"));
    }
    if (action === "import_starter") {
      const a = await adminFor(req, "content");
      const rows = (starter as { questions: (QuestionInput & { id: string })[] }).questions.map((input, i) => ({ input, line: i + 1 }));
      return ok(await importQuestions(db(), a, rows, "ai-draft"));
    }
    if (action === "publish") { await adminFor(req, "content"); const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).map(String).slice(0, 200); const out = []; for (const id of ids) out.push(await publishQuestion(db(), id, b.publish !== false).then((r) => ({ id, ...r })).catch((e) => ({ id, error: String((e as Error).message) }))); return ok({ results: out }); }
    if (action === "save_subject") {
      await adminFor(req, "content");
      const exam = b.exam;
      if (!isExamId(exam)) throw new PrepError("Choose JAMB, WAEC or NECO.");
      const name = String(b.name ?? "").trim();
      if (name.length < 2 || name.length > 60) throw new PrepError("Name the subject (2 to 60 characters).");
      const id = String(b.id || slug(name));
      const topics = (Array.isArray(b.topics) ? b.topics : []).map((t: { id?: string; name?: string }) => ({ id: String(t.id || slug(String(t.name ?? ""))), name: String(t.name ?? "").trim() })).filter((t: { id: string; name: string }) => t.id && t.name).slice(0, 60);
      if (!topics.length) throw new PrepError("Add at least one topic.");
      const approvals = Number(b.approvalsNeeded ?? 1);
      if (![1, 2].includes(approvals)) throw new PrepError("Approvals needed: 1 or 2.");
      const sub: Subject = { exam: exam as ExamId, id, name, topics, order: Number(b.order ?? 9), live: b.live !== false, approvalsNeeded: approvals };
      await db().doc(`prepSubjects/${subjectKey(exam as ExamId, id)}`).set(sub);
      return ok({ subject: sub });
    }
    if (action === "invite") { const a = await adminFor(req, "content"); return ok(await createInvite(db(), a, { subjects: b.subjects, kind: b.kind, days: b.days, maxUses: b.maxUses, note: b.note })); }
    // Approve all shown: a content admin approves every in-review question on their list in one go, recorded as the reviewer on each
    // (the usual rules apply: not a question they wrote, and only questions still in review).
    if (action === "approve_all") {
      const a = await adminFor(req, "content");
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, 500);
      const results: { id: string; status?: string; error?: string }[] = [];
      for (const id of ids) results.push(await reviewQuestion(db(), a, id, "approve", "").then((r) => ({ id, status: r.status })).catch((e) => ({ id, error: String((e as Error).message) })));
      return ok({ approved: results.filter((r) => r.status === "approved").length, results });
    }
    if (action === "close_invite") { await adminFor(req, "content"); return ok(await closeInvite(db(), b.id)); }
    if (action === "reviewer_subjects") {
      await adminFor(req, "content");
      const known = new Set((await allSubjects(db())).map((x) => subjectKey(x.exam, x.id)));
      const subjects = (Array.isArray(b.subjects) ? b.subjects : []).map(String).filter((k: string) => known.has(k));
      await db().doc(`prepReviewers/${String(b.uid).replace(/\//g, "")}`).set({ subjects }, { merge: true });
      return ok({ subjects });
    }
    if (action === "reviewer_active") { await adminFor(req, "content"); await db().doc(`prepReviewers/${String(b.uid).replace(/\//g, "")}`).set({ active: b.active === true }, { merge: true }); return ok({ ok: true }); }
    if (action === "resolve_report") { const a = await adminFor(req, "content"); await db().doc(`prepReports/${String(b.id).replace(/\//g, "")}`).update({ status: "resolved", resolvedBy: a.name, resolution: String(b.note ?? "").slice(0, 500), resolvedAt: new Date().toISOString() }); return ok({ ok: true }); }
    if (action === "save_pack") {
      await adminFor(req, "finance");
      const exam = b.exam;
      if (!isExamId(exam)) throw new PrepError("Choose JAMB, WAEC or NECO.");
      const naira = Number(b.priceNaira), months = Number(b.months);
      if (!Number.isInteger(naira) || naira < 100 || naira > 100_000) throw new PrepError("Price: a whole amount from ₦100 to ₦100,000.");
      if (!Number.isInteger(months) || months < 1 || months > 24) throw new PrepError("Access: 1 to 24 months.");
      await db().doc(`prepPacks/${exam}`).set({ id: exam, exam, name: `${EXAMS[exam as ExamId].name} pack`, priceKobo: naira * 100, months, available: b.available !== false });
      return ok({ packs: await allPacks(db()) });
    }
    if (action === "grant") { const a = await adminFor(req, "finance"); return ok(await adminGrant(db(), a, String(b.uid), b.exam, b.months, b.note)); }
    if (action === "refund") { await adminFor(req, "finance"); return ok(await adminRefund(db(), b.reference, (ref) => refundPayment(ref))); }
    // A student says they paid but the pack didn't open: check that one payment with Paystack (never charges again).
    if (action === "recheck") {
      await adminFor(req, "finance");
      const ref = String(b.reference ?? "");
      const p = (await db().doc(`payments/${ref}`).get()).data();
      if (!p || p.kind !== "exam_pack") throw new PrepError("That pack payment wasn't found.", 404);
      const r = await fulfillPayment(ref).then((x) => ({ status: x.status })).catch((e) => ({ status: "pending", note: String((e as Error).message) }));
      return ok(r);
    }
    throw new PrepError("Unknown action.");
  } catch (e) { return fail(e); }
}
