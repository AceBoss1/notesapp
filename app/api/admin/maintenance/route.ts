import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { BACKFILLS, PlanChanged, isBackfill, listRuns, runBackfill, undoRun } from "@/lib/backfills";
import { bankClear, bankDays, bankStats } from "@/lib/nana-bank";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Admin → Maintenance (app/(main)/admin/maintenance). Owner and super admins only: these write to every journal.
// GET → when each backfill last ran (maintenance/<job>). POST { job, apply } → runs it (lib/backfills.ts): a dry run lists what
// it would change and touches nothing (with its planHash); apply: true writes the same list, only with that planHash (409 with
// the fresh list if the journals changed since) and backupConfirmed: true. Each apply is a run with before-images (GET runs);
// POST { job: "undo", runId } puts one back. Safe to re-run: both only fill what's missing.
// Nana's answer bank (lib/nana-bank.ts): GET includes its size and most asked; POST { job: "bank-clear" } empties it.
async function admin(req: NextRequest) {
  return verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), "super");
}
const iso = (v: unknown) => (v && typeof (v as { toDate?: () => Date }).toDate === "function" ? (v as { toDate: () => Date }).toDate().toISOString() : null);

async function status() {
  const snaps = await Promise.all(BACKFILLS.map((j) => getAdminDb().doc(`maintenance/${j}`).get()));
  return Object.fromEntries(snaps.map((s, i) => {
    const d = s.data() ?? {};
    return [BACKFILLS[i], { checkedAt: iso(d.checkedAt), pending: typeof d.pending === "number" ? d.pending : null, appliedAt: iso(d.appliedAt), applied: typeof d.applied === "number" ? d.applied : null, appliedBy: String(d.appliedByName ?? "") }];
  }));
}

const bank = async () => ({ ...(await bankStats(getAdminDb(), new Date())), days: bankDays() });

export async function GET(req: NextRequest) {
  try { await admin(req); } catch { return NextResponse.json({ error: "Owner and super admins only." }, { status: 403 }); }
  return NextResponse.json({ jobs: await status(), runs: await listRuns(getAdminDb()), bank: await bank() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let uid: string;
  try { uid = await admin(req); } catch { return NextResponse.json({ error: "Owner and super admins only." }, { status: 403 }); }
  const { job, apply, planHash, backupConfirmed, runId } = (await req.json().catch(() => ({}))) as { job?: unknown; apply?: unknown; planHash?: unknown; backupConfirmed?: unknown; runId?: unknown };
  if (job === "bank-clear") {
    const cleared = await bankClear(getAdminDb());
    return NextResponse.json({ cleared, bank: await bank() });
  }
  const db = getAdminDb();
  const by = { uid, name: String((await db.doc(`users/${uid}`).get()).data()?.displayName ?? "") };
  if (job === "undo") {
    if (typeof runId !== "string" || !/^[\w-]{1,80}$/.test(runId)) return NextResponse.json({ error: "Which run?" }, { status: 400 });
    try {
      const undone = await undoRun(db, runId, by);
      return NextResponse.json({ undone, runs: await listRuns(db) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't undo that run." }, { status: 409 });
    }
  }
  if (!isBackfill(job)) return NextResponse.json({ error: "Unknown job." }, { status: 400 });
  if (apply === true) {
    if (typeof planHash !== "string") return NextResponse.json({ error: "Run the dry run first." }, { status: 400 });
    if (backupConfirmed !== true) return NextResponse.json({ error: "Take a backup first, then tick the box." }, { status: 400 });
  }
  let result;
  try {
    result = await runBackfill(db, job, apply === true, { planHash: planHash as string | undefined, by, backupConfirmed: backupConfirmed === true });
  } catch (e) {
    if (!(e instanceof PlanChanged)) throw e;
    await db.doc(`maintenance/${job}`).set({ checkedAt: FieldValue.serverTimestamp(), pending: e.fresh.changes.length }, { merge: true });
    return NextResponse.json({ error: e.message, fresh: e.fresh, jobs: await status() }, { status: 409 });
  }
  await db.doc(`maintenance/${job}`).set(apply === true
    ? { appliedAt: FieldValue.serverTimestamp(), applied: result.changes.length, appliedBy: uid, appliedByName: by.name, checkedAt: FieldValue.serverTimestamp(), pending: 0 }
    : { checkedAt: FieldValue.serverTimestamp(), pending: result.changes.length }, { merge: true });
  return NextResponse.json({ ...result, jobs: await status(), runs: await listRuns(db) });
}
