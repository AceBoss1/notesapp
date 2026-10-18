import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { BACKFILLS, isBackfill, runBackfill } from "@/lib/backfills";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Admin → Maintenance (app/(main)/admin/maintenance). Owner and super admins only: these write to every journal.
// GET → when each backfill last ran (maintenance/<job>). POST { job, apply } → runs it (lib/backfills.ts): a dry run lists what
// it would change and touches nothing; apply: true writes the same list. Safe to re-run: both only fill what's missing.
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

export async function GET(req: NextRequest) {
  try { await admin(req); } catch { return NextResponse.json({ error: "Owner and super admins only." }, { status: 403 }); }
  return NextResponse.json({ jobs: await status() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let uid: string;
  try { uid = await admin(req); } catch { return NextResponse.json({ error: "Owner and super admins only." }, { status: 403 }); }
  const { job, apply } = (await req.json().catch(() => ({}))) as { job?: unknown; apply?: unknown };
  if (!isBackfill(job)) return NextResponse.json({ error: "Unknown job." }, { status: 400 });
  const db = getAdminDb();
  const result = await runBackfill(db, job, apply === true);
  const who = String((await db.doc(`users/${uid}`).get()).data()?.displayName ?? "");
  await db.doc(`maintenance/${job}`).set(apply === true
    ? { appliedAt: FieldValue.serverTimestamp(), applied: result.changes.length, appliedBy: uid, appliedByName: who, checkedAt: FieldValue.serverTimestamp(), pending: 0 }
    : { checkedAt: FieldValue.serverTimestamp(), pending: result.changes.length }, { merge: true });
  return NextResponse.json({ ...result, jobs: await status() });
}
