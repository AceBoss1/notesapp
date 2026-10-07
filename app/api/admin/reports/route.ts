import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { listReports, reportCounts, resolveReport, suspendFromReport } from "@/lib/reports-server";
import { momentDeps } from "@/lib/moments-api";
import { MomentError } from "@/lib/moments-server";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: GET ?counts=1 → { open, urgent, overdue }; GET ?status=open|resolved → reports with what was reported (open ones only); POST { id, outcome: "dismissed"|"actioned", note? } or { id, suspend: true, length: "1d"|"3d"|"1w"|"2w"|"1m"|"3m"|"6m"|"1y"|"indefinite", note? } (suspends the reported member, then actions it)
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    if (req.nextUrl.searchParams.get("counts") === "1") return NextResponse.json(await reportCounts(getAdminDb())); // the dashboard card
    const status = req.nextUrl.searchParams.get("status") === "resolved" ? "resolved" : "open";
    const db = getAdminDb();
    const rows = await listReports(db, status);
    const uids = Array.from(new Set(rows.flatMap((r) => [r.reporterUid, r.targetUid])));
    const users = uids.length ? await db.getAll(...uids.map((u) => db.doc(`users/${u}`))) : [];
    const names = Object.fromEntries(users.map((u) => [u.id, u.data()?.username ?? u.id]));
    return NextResponse.json({ reports: rows.map((r) => ({ ...r, reporter: names[r.reporterUid], target: names[r.targetUid], mediaUrls: (r.evidenceKeys ?? []).map((k) => momentDeps.publicUrl(k)) })) });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load reports");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminRequest(bearer(req));
    const body = await req.json().catch(() => ({}));
    if (body.suspend === true) await suspendFromReport(getAdminDb(), admin, String(body.id ?? ""), body.note, body.length, momentDeps); // also actions the report
    else await resolveReport(getAdminDb(), admin, String(body.id ?? ""), body.outcome, body.note, momentDeps);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof MomentError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't resolve the report");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
